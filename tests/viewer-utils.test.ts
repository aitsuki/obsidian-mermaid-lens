import { describe, expect, it, vi } from "vitest";
import {
  diagramSize,
  fitView,
  MAX_SCALE,
  MIN_SCALE,
  panView,
  pinchView,
  remapSvgIds,
  zoomView
} from "../src/viewer-utils";

function svgWithViewBox(width: number, height: number): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  Object.defineProperty(svg, "viewBox", { value: { baseVal: { width, height } } });
  return svg;
}

describe("diagramSize", () => {
  it("prefers a valid viewBox", () => {
    const svg = svgWithViewBox(640, 480);
    svg.setAttribute("width", "10");
    expect(diagramSize(svg)).toEqual({ width: 640, height: 480 });
  });

  it("falls back to attributes and then defaults", () => {
    const svg = svgWithViewBox(0, 0);
    svg.setAttribute("width", "320px");
    svg.setAttribute("height", "200");
    expect(diagramSize(svg)).toEqual({ width: 320, height: 200 });
    svg.setAttribute("width", "invalid");
    svg.setAttribute("height", "-1");
    expect(diagramSize(svg)).toEqual({ width: 800, height: 500 });
  });
});

describe("view calculations", () => {
  it("fits and centers a diagram", () => {
    expect(fitView({ width: 1000, height: 600 }, { width: 800, height: 400 })).toEqual({
      scale: 1.19,
      x: 24,
      y: 62
    });
    expect(fitView({ width: 0, height: 600 }, { width: 1, height: 1 })).toBeUndefined();
  });

  it("clamps fit and zoom to supported limits", () => {
    expect(fitView({ width: 10, height: 10 }, { width: 10000, height: 10000 })?.scale).toBe(MIN_SCALE);
    expect(fitView({ width: 1000, height: 1000 }, { width: 1, height: 1 })?.scale).toBe(MAX_SCALE);
    expect(zoomView({ scale: 1, x: 0, y: 0 }, 100, { x: 50, y: 50 }).scale).toBe(MAX_SCALE);
    expect(zoomView({ scale: 1, x: 0, y: 0 }, 0.001, { x: 50, y: 50 }).scale).toBe(MIN_SCALE);
  });

  it("keeps the anchor stable while zooming", () => {
    const result = zoomView({ scale: 2, x: 10, y: 20 }, 1.5, { x: 110, y: 220 });
    expect(result).toEqual({ scale: 3, x: -40, y: -80 });
  });

  it("calculates pan and pinch gestures", () => {
    expect(panView({ pointer: { x: 10, y: 20 }, x: 30, y: 40 }, { x: 25, y: 15 }))
      .toEqual({ x: 45, y: 35 });
    expect(pinchView({ distance: 100, scale: 1, anchor: { x: 50, y: 40 } }, 200, { x: 120, y: 100 }))
      .toEqual({ scale: 2, x: 20, y: 20 });
  });
});

describe("remapSvgIds", () => {
  it("rewrites IDs and references in attributes, ARIA, and styles", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const svg = svgWithViewBox(100, 100);
    svg.id = "root";
    const element = (tag: string, attributes: Record<string, string> = {}): SVGElement => {
      const child = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [name, value] of Object.entries(attributes)) child.setAttribute(name, value);
      svg.appendChild(child);
      return child;
    };
    const arrow = element("marker", { id: "arrow" });
    element("filter", { id: "glow" });
    const style = element("style");
    style.textContent = "#arrow { fill: red } #arrow-long { fill: blue }";
    const line = element("path", { id: "line", "marker-end": "url('#arrow')", filter: "url(#glow)" });
    const use = element("use", { href: "#line", "aria-labelledby": "line arrow external" });

    remapSvgIds(svg);
    expect(svg.id).toMatch(/^mermaid-lens-123-\d+-root$/);
    expect(line.getAttribute("marker-end")).toBe(`url(#${arrow.id})`);
    expect(line.getAttribute("filter")).toContain("mermaid-lens-123-");
    expect(use.getAttribute("href")).toBe(`#${line.id}`);
    expect(use.getAttribute("aria-labelledby")).toBe(`${line.id} ${arrow.id} external`);
    expect(svg.querySelector("style")?.textContent).toContain(`#${arrow.id}`);
    expect(svg.querySelector("style")?.textContent).toContain("#arrow-long");
  });

  it("generates different IDs for separate clones", () => {
    const first = svgWithViewBox(1, 1);
    const second = svgWithViewBox(1, 1);
    first.id = second.id = "same";
    remapSvgIds(first);
    remapSvgIds(second);
    expect(first.id).not.toBe(second.id);
  });
});
