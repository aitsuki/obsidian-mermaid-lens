import { App, setIcon } from "obsidian";
import type { OpenTrigger } from "./settings";
import { MermaidViewerModal } from "./viewer";

const HOST_SELECTOR = ".mermaid, .mermaid-preview";
const MOUNTED_CLASS = "mermaid-lens-host";

interface RegistryOptions {
  getTrigger(): OpenTrigger;
  showExpandButton(): boolean;
}

interface HostHandlers {
  click(event: MouseEvent): void;
  doubleClick(event: MouseEvent): void;
}

type ViewerOpener = (app: App, svg: SVGSVGElement) => void;

const openViewer: ViewerOpener = (app, svg) => new MermaidViewerModal(app, svg).open();

function asElement(value: EventTarget | null): Element | null {
  return value !== null && typeof (value as Element).closest === "function"
    ? value as Element
    : null;
}

export class DiagramRegistry {
  private readonly app: App;
  private readonly options: RegistryOptions;
  private readonly viewerOpener: ViewerOpener;
  private readonly handlers = new WeakMap<HTMLElement, HostHandlers>();

  constructor(app: App, options: RegistryOptions, viewerOpener: ViewerOpener = openViewer) {
    this.app = app;
    this.options = options;
    this.viewerOpener = viewerOpener;
  }

  scan(root: ParentNode): void {
    if (root.nodeType === 1) {
      const element = root as HTMLElement;
      if (element.matches(HOST_SELECTOR)) this.mount(element);
    }
    root.querySelectorAll<HTMLElement>(HOST_SELECTOR).forEach((host) => this.mount(host));
  }

  refresh(roots: ParentNode[]): void {
    for (const root of roots) {
      this.scan(root);
      root.querySelectorAll<HTMLElement>(`.${MOUNTED_CLASS}`).forEach((host) => {
        this.syncHostState(host);
      });
    }
  }

  dispose(roots: ParentNode[]): void {
    for (const root of roots) {
      root.querySelectorAll<HTMLElement>(`.${MOUNTED_CLASS}`).forEach((host) => {
        const handlers = this.handlers.get(host);
        if (handlers) {
          host.removeEventListener("click", handlers.click);
          host.removeEventListener("dblclick", handlers.doubleClick);
          this.handlers.delete(host);
        }
        host.querySelector(":scope > .mermaid-lens-expand")?.remove();
        host.removeAttribute("data-mermaid-lens-trigger");
        host.removeClass(MOUNTED_CLASS);
      });
    }
  }

  private mount(host: HTMLElement): void {
    if (!host.querySelector("svg")) return;
    if (!this.handlers.has(host)) {
      const handlers: HostHandlers = {
        click: (event) => this.handleOpenEvent(host, event, "single"),
        doubleClick: (event) => this.handleOpenEvent(host, event, "double")
      };
      this.handlers.set(host, handlers);
      host.addEventListener("click", handlers.click);
      host.addEventListener("dblclick", handlers.doubleClick);
      host.addClass(MOUNTED_CLASS);
    }
    this.syncHostState(host);
  }

  private syncHostState(host: HTMLElement): void {
    host.dataset.mermaidLensTrigger = this.options.getTrigger();
    let button = host.querySelector<HTMLButtonElement>(":scope > .mermaid-lens-expand");

    if (!this.options.showExpandButton()) {
      button?.remove();
      return;
    }
    if (button) return;

    button = host.ownerDocument.createElement("button");
    button.className = "mermaid-lens-expand";
    button.setAttribute("aria-label", "打开 Mermaid 大图");
    button.setAttribute("title", "打开大图");
    setIcon(button, "expand");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.open(host);
    });
    host.appendChild(button);
  }

  private handleOpenEvent(host: HTMLElement, event: MouseEvent, eventTrigger: OpenTrigger): void {
    if (this.options.getTrigger() !== eventTrigger) return;
    const target = asElement(event.target);
    if (!target || target.closest("a, button")) return;
    event.preventDefault();
    event.stopPropagation();
    this.open(host);
  }

  private open(host: HTMLElement): void {
    const svg = host.querySelector<SVGSVGElement>("svg");
    if (svg) this.viewerOpener(this.app, svg);
  }
}
