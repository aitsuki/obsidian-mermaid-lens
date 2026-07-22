export interface Size { width: number; height: number }
export interface Point { x: number; y: number }
export interface ViewState { scale: number; x: number; y: number }
export interface PanStart { pointer: Point; x: number; y: number }
export interface PinchStart { distance: number; scale: number; anchor: Point }

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 10;
const VIEWPORT_PADDING = 48;
let cloneSequence = 0;

export function diagramSize(svg: SVGSVGElement): Size {
  const viewBox = svg.viewBox.baseVal;
  if (viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }
  const width = Number.parseFloat(svg.getAttribute("width") ?? "");
  const height = Number.parseFloat(svg.getAttribute("height") ?? "");
  return {
    width: Number.isFinite(width) && width > 0 ? width : 800,
    height: Number.isFinite(height) && height > 0 ? height : 500
  };
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function fitView(viewport: Size, diagram: Size): ViewState | undefined {
  if (viewport.width <= 0 || viewport.height <= 0) return undefined;
  const width = Math.max(viewport.width - VIEWPORT_PADDING, 1);
  const height = Math.max(viewport.height - VIEWPORT_PADDING, 1);
  const scale = clamp(Math.min(width / diagram.width, height / diagram.height), MIN_SCALE, MAX_SCALE);
  return {
    scale,
    x: (viewport.width - diagram.width * scale) / 2,
    y: (viewport.height - diagram.height * scale) / 2
  };
}

export function zoomView(state: ViewState, factor: number, anchor: Point): ViewState {
  const diagramX = (anchor.x - state.x) / state.scale;
  const diagramY = (anchor.y - state.y) / state.scale;
  const scale = clamp(state.scale * factor, MIN_SCALE, MAX_SCALE);
  return {
    scale,
    x: anchor.x - diagramX * scale,
    y: anchor.y - diagramY * scale
  };
}

export function panView(start: PanStart, pointer: Point): Pick<ViewState, "x" | "y"> {
  return {
    x: start.x + pointer.x - start.pointer.x,
    y: start.y + pointer.y - start.pointer.y
  };
}

export function pinchView(start: PinchStart, distance: number, center: Point): ViewState {
  const scale = clamp(start.scale * distance / Math.max(start.distance, 1), MIN_SCALE, MAX_SCALE);
  return {
    scale,
    x: center.x - start.anchor.x * scale,
    y: center.y - start.anchor.y * scale
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Prevent cloned SVG marker/filter/gradient IDs from colliding with the source. */
export function remapSvgIds(svg: SVGSVGElement): void {
  const prefix = `mermaid-lens-${Date.now()}-${cloneSequence++}-`;
  const idMap = new Map<string, string>();
  const elements = [svg, ...Array.from(svg.querySelectorAll<SVGElement>("*"))];

  for (const element of elements) {
    const oldId = element.id;
    if (!oldId) continue;
    const newId = `${prefix}${oldId}`;
    idMap.set(oldId, newId);
    element.id = newId;
  }

  for (const element of elements) {
    for (const attribute of Array.from(element.attributes)) {
      let value = attribute.value;
      for (const [oldId, newId] of idMap) {
        value = value.replace(new RegExp(`url\\(["']?#${escapeRegExp(oldId)}["']?\\)`, "g"), `url(#${newId})`);
        if (value === `#${oldId}`) value = `#${newId}`;
      }
      if (attribute.name === "aria-labelledby" || attribute.name === "aria-describedby") {
        value = value.split(/\s+/).map((id) => idMap.get(id) ?? id).join(" ");
      }
      if (value !== attribute.value) element.setAttribute(attribute.name, value);
    }
  }

  svg.querySelectorAll("style").forEach((style) => {
    let css = style.textContent ?? "";
    for (const [oldId, newId] of idMap) {
      css = css.replace(new RegExp(`#${escapeRegExp(oldId)}(?![\\w-])`, "g"), `#${newId}`);
    }
    style.textContent = css;
  });
}
