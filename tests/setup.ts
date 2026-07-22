import { vi } from "vitest";

interface ObsidianElement extends HTMLElement {
  addClass(...classes: string[]): void;
  removeClass(...classes: string[]): void;
  empty(): void;
  createDiv(options?: { cls?: string; text?: string }): HTMLDivElement;
  createEl<K extends keyof HTMLElementTagNameMap>(tag: K, options?: {
    cls?: string;
    text?: string;
    attr?: Record<string, string>;
  }): HTMLElementTagNameMap[K];
}

const elementPrototype = Element.prototype as unknown as ObsidianElement;
elementPrototype.addClass = function (...classes: string[]): void { this.classList.add(...classes); };
elementPrototype.removeClass = function (...classes: string[]): void { this.classList.remove(...classes); };
const prototype = HTMLElement.prototype as unknown as ObsidianElement;
prototype.empty = function (): void { this.replaceChildren(); };
prototype.createDiv = function (options = {}): HTMLDivElement {
  return this.createEl("div", options);
};
prototype.createEl = function (tag, options = {}) {
  const element = this.ownerDocument.createElement(tag);
  if (options.cls) element.className = options.cls;
  if (options.text) element.textContent = options.text;
  for (const [name, value] of Object.entries(options.attr ?? {})) element.setAttribute(name, value);
  this.appendChild(element);
  return element;
};

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];
  readonly callback: ResizeObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

if (!(SVGSVGElement.prototype as unknown as { viewBox?: unknown }).viewBox) {
  Object.defineProperty(SVGSVGElement.prototype, "viewBox", {
    configurable: true,
    get() {
      const values = (this.getAttribute("viewBox") ?? "0 0 0 0").split(/[,\s]+/).map(Number);
      return { baseVal: { width: values[2] || 0, height: values[3] || 0 } };
    }
  });
}

if (!HTMLElement.prototype.setPointerCapture) {
  const captures = new WeakMap<HTMLElement, Set<number>>();
  HTMLElement.prototype.setPointerCapture = function (id: number): void {
    const ids = captures.get(this) ?? new Set<number>();
    ids.add(id);
    captures.set(this, ids);
  };
  HTMLElement.prototype.hasPointerCapture = function (id: number): boolean {
    return captures.get(this)?.has(id) ?? false;
  };
  HTMLElement.prototype.releasePointerCapture = function (id: number): void {
    captures.get(this)?.delete(id);
  };
}
