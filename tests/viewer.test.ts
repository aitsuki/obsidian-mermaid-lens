import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { MermaidViewerModal } from "../src/viewer";

function sourceSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 800 400");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.id = "arrow";
  svg.appendChild(marker);
  return svg;
}

describe("MermaidViewerModal", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds the modal, fits the clone, and wires toolbar zoom", async () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
    const modal = new MermaidViewerModal(new App(), sourceSvg());
    const register = vi.spyOn(modal.scope, "register");
    modal.onOpen();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(modal.modalEl.classList.contains("mermaid-lens-modal")).toBe(true);
    expect(modal.contentEl.querySelector(".mermaid-lens-title")?.textContent).toBe("Mermaid");
    const clone = modal.contentEl.querySelector<SVGSVGElement>("svg")!;
    expect(clone).not.toBeNull();
    expect(clone.id).not.toBe("arrow");
    expect(clone.style.transform).toContain("scale(1.19)");
    expect(register).toHaveBeenCalledTimes(3);

    const buttons = modal.contentEl.querySelectorAll<HTMLButtonElement>("button");
    buttons[2].click();
    expect(clone.style.transform).toContain("scale(1.428)");
    buttons[0].click();
    buttons[1].click();
    expect(clone.style.transform).toContain("scale(1.19)");
  });

  it("handles wheel, mouse pan, pinch, fit, resize, and cleanup", async () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
    const modal = new MermaidViewerModal(new App(), sourceSvg());
    modal.onOpen();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const stage = modal.contentEl.querySelector<HTMLElement>(".mermaid-lens-stage")!;
    const clone = stage.querySelector<SVGSVGElement>("svg")!;
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0 } as DOMRect);

    stage.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, clientX: 200, clientY: 100, cancelable: true }));
    expect(clone.style.transform).not.toContain("scale(1.19)");

    stage.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 1, pointerType: "mouse", button: 0, clientX: 100, clientY: 100, bubbles: true
    }));
    stage.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 1, pointerType: "mouse", clientX: 150, clientY: 130, bubbles: true
    }));
    expect(stage.classList.contains("is-dragging")).toBe(true);
    stage.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 2, pointerType: "touch", clientX: 200, clientY: 100, bubbles: true
    }));
    stage.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 2, pointerType: "touch", clientX: 300, clientY: 100, bubbles: true
    }));
    stage.dispatchEvent(new PointerEvent("pointerup", { pointerId: 2, pointerType: "touch" }));
    stage.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, pointerType: "mouse" }));
    expect(stage.classList.contains("is-dragging")).toBe(false);

    stage.dispatchEvent(new MouseEvent("dblclick", { cancelable: true }));
    const observers = (ResizeObserver as unknown as { instances: Array<{ callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }> }).instances;
    observers.at(-1)!.callback([], observers.at(-1) as never);
    const disconnect = observers.at(-1)!.disconnect;
    modal.onClose();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(modal.contentEl.childElementCount).toBe(0);
  });

  it("ignores non-primary mouse buttons", async () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
    const modal = new MermaidViewerModal(new App(), sourceSvg());
    modal.onOpen();
    const stage = modal.contentEl.querySelector<HTMLElement>(".mermaid-lens-stage")!;
    stage.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, pointerType: "mouse", button: 1 }));
    expect(stage.classList.contains("is-dragging")).toBe(false);
    modal.onClose();
  });
});
