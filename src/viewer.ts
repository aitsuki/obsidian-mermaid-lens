import { App, Modal, setIcon } from "obsidian";
import { t } from "./i18n";
import {
  diagramSize,
  fitView,
  panView,
  pinchView,
  Point,
  remapSvgIds,
  Size,
  ViewState,
  zoomView
} from "./viewer-utils";

export class MermaidViewerModal extends Modal {
  private readonly source: SVGSVGElement;
  private cleanup?: () => void;

  constructor(app: App, source: SVGSVGElement) {
    super(app);
    this.source = source;
  }

  onOpen(): void {
    this.modalEl.addClass("mermaid-lens-modal");
    this.contentEl.empty();

    const toolbar = this.contentEl.createDiv({ cls: "mermaid-lens-toolbar" });
    toolbar.createDiv({ cls: "mermaid-lens-title", text: "Mermaid" });
    toolbar.createDiv({
      cls: "mermaid-lens-help",
      text: t("viewer.help")
    });

    const controls = toolbar.createDiv({ cls: "mermaid-lens-controls" });
    const stage = this.contentEl.createDiv({ cls: "mermaid-lens-stage" });
    const svg = this.source.cloneNode(true) as SVGSVGElement;
    remapSvgIds(svg);
    const size = diagramSize(svg);

    svg.setAttribute("width", String(size.width));
    svg.setAttribute("height", String(size.height));
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.addClass("mermaid-lens-clone");
    svg.style.width = `${size.width}px`;
    svg.style.height = `${size.height}px`;
    stage.appendChild(svg);

    const handlers = this.setupPanZoom(stage, svg, size);
    this.cleanup = handlers.cleanup;
    this.makeButton(controls, "zoom-out", t("viewer.zoomOut"), () => handlers.zoom(1 / 1.2));
    this.makeButton(controls, "scan", t("viewer.fit"), handlers.fit);
    this.makeButton(controls, "zoom-in", t("viewer.zoomIn"), () => handlers.zoom(1.2));

    this.scope.register([], "+", () => { handlers.zoom(1.2); return false; });
    this.scope.register([], "=", () => { handlers.zoom(1.2); return false; });
    this.scope.register([], "-", () => { handlers.zoom(1 / 1.2); return false; });
  }

  onClose(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    this.contentEl.empty();
  }

  private makeButton(parent: HTMLElement, icon: string, label: string, action: () => void): void {
    const button = parent.createEl("button", { attr: { "aria-label": label, title: label } });
    setIcon(button, icon);
    button.addEventListener("click", action);
  }

  private setupPanZoom(stage: HTMLElement, svg: SVGSVGElement, size: Size): {
    zoom: (factor: number) => void;
    fit: () => void;
    cleanup: () => void;
  } {
    const state: ViewState = { scale: 1, x: 0, y: 0 };
    const pointers = new Map<number, Point>();
    const ownerWindow = stage.ownerDocument.defaultView ?? window;
    let initialized = false;
    let userChangedView = false;
    let disposed = false;
    let initFrame = 0;
    let panStart: { pointer: Point; x: number; y: number } | undefined;
    let pinchStart: { distance: number; scale: number; anchor: Point } | undefined;

    const render = (): void => {
      svg.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    };

    const fitInternal = (): boolean => {
      if (stage.clientWidth <= 0 || stage.clientHeight <= 0) return false;
      const fitted = fitView({ width: stage.clientWidth, height: stage.clientHeight }, size);
      if (!fitted) return false;
      Object.assign(state, fitted);
      initialized = true;
      render();
      return true;
    };

    const fit = (): void => {
      userChangedView = false;
      fitInternal();
    };

    const initializeWhenLaidOut = (attempt = 0): void => {
      if (disposed || initialized) return;
      if (!fitInternal() && attempt < 30) {
        initFrame = ownerWindow.requestAnimationFrame(() => initializeWhenLaidOut(attempt + 1));
      }
    };
    initFrame = ownerWindow.requestAnimationFrame(() => initializeWhenLaidOut());

    const zoomAt = (factor: number, point?: Point): void => {
      if (!initialized && !fitInternal()) return;
      const anchor = point ?? { x: stage.clientWidth / 2, y: stage.clientHeight / 2 };
      Object.assign(state, zoomView(state, factor, anchor));
      userChangedView = true;
      render();
    };

    const localPoint = (event: PointerEvent | WheelEvent): Point => {
      const rect = stage.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

    const beginGesture = (): void => {
      const points = Array.from(pointers.values());
      if (points.length === 1) {
        panStart = { pointer: points[0], x: state.x, y: state.y };
        pinchStart = undefined;
      } else if (points.length >= 2) {
        const center = midpoint(points[0], points[1]);
        pinchStart = {
          distance: Math.max(distance(points[0], points[1]), 1),
          scale: state.scale,
          anchor: {
            x: (center.x - state.x) / state.scale,
            y: (center.y - state.y) / state.scale
          }
        };
        panStart = undefined;
      }
    };

    const pointerDown = (event: PointerEvent): void => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      pointers.set(event.pointerId, localPoint(event));
      stage.setPointerCapture(event.pointerId);
      stage.addClass("is-dragging");
      beginGesture();
    };
    const pointerMove = (event: PointerEvent): void => {
      if (!pointers.has(event.pointerId)) return;
      event.preventDefault();
      pointers.set(event.pointerId, localPoint(event));
      const points = Array.from(pointers.values());
      if (points.length >= 2 && pinchStart) {
        const center = midpoint(points[0], points[1]);
        Object.assign(state, pinchView(pinchStart, distance(points[0], points[1]), center));
      } else if (points.length === 1 && panStart) {
        Object.assign(state, panView(panStart, points[0]));
      }
      userChangedView = true;
      render();
    };
    const pointerEnd = (event: PointerEvent): void => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      if (pointers.size === 0) {
        stage.removeClass("is-dragging");
        panStart = undefined;
        pinchStart = undefined;
      } else {
        beginGesture();
      }
    };
    const wheel = (event: WheelEvent): void => {
      event.preventDefault();
      const delta = event.deltaMode === event.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      zoomAt(Math.exp(-delta * 0.0015), localPoint(event));
    };
    const doubleClick = (event: MouseEvent): void => {
      event.preventDefault();
      fit();
    };

    stage.addEventListener("pointerdown", pointerDown);
    stage.addEventListener("pointermove", pointerMove);
    stage.addEventListener("pointerup", pointerEnd);
    stage.addEventListener("pointercancel", pointerEnd);
    stage.addEventListener("wheel", wheel, { passive: false });
    stage.addEventListener("dblclick", doubleClick);

    const resizeObserver = new ResizeObserver(() => {
      if (!initialized || !userChangedView) fitInternal();
    });
    resizeObserver.observe(stage);

    return {
      zoom: (factor) => zoomAt(factor),
      fit,
      cleanup: () => {
        disposed = true;
        ownerWindow.cancelAnimationFrame(initFrame);
        resizeObserver.disconnect();
        stage.removeEventListener("pointerdown", pointerDown);
        stage.removeEventListener("pointermove", pointerMove);
        stage.removeEventListener("pointerup", pointerEnd);
        stage.removeEventListener("pointercancel", pointerEnd);
        stage.removeEventListener("wheel", wheel);
        stage.removeEventListener("dblclick", doubleClick);
      }
    };
  }
}
