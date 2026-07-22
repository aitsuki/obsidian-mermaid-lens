import { describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { DiagramRegistry } from "../src/diagram-registry";
import type { OpenTrigger } from "../src/settings";

function fixture(withSvg = true) {
  const root = document.createElement("div");
  const host = document.createElement("div");
  host.className = "mermaid";
  if (withSvg) host.innerHTML = '<svg viewBox="0 0 100 100"><path /></svg>';
  root.appendChild(host);
  document.body.appendChild(root);
  return { root, host, svg: host.querySelector("svg") };
}

describe("DiagramRegistry", () => {
  it("ignores hosts without SVG and mounts a host only once", () => {
    const empty = fixture(false);
    const open = vi.fn();
    const registry = new DiagramRegistry(new App(), {
      getTrigger: () => "double",
      showExpandButton: () => true
    }, open);
    registry.scan(empty.root);
    expect(empty.host.classList.contains("mermaid-lens-host")).toBe(false);

    const { root, host } = fixture();
    registry.scan(root);
    registry.scan(root);
    expect(host.querySelectorAll(".mermaid-lens-expand")).toHaveLength(1);
    host.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    expect(open).toHaveBeenCalledOnce();
  });

  it.each([
    ["single", "click"],
    ["double", "dblclick"]
  ] as const)("opens for the %s trigger", (trigger, eventName) => {
    const { root, host, svg } = fixture();
    const open = vi.fn();
    const registry = new DiagramRegistry(new App(), {
      getTrigger: () => trigger,
      showExpandButton: () => false
    }, open);
    registry.scan(root);
    const event = new MouseEvent(eventName, { bubbles: true, cancelable: true });
    host.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith(expect.any(App), svg);
  });

  it("does not open for a mismatched trigger or events from links and buttons", () => {
    const { root, host } = fixture();
    host.insertAdjacentHTML("beforeend", '<a href="#">link</a><button>action</button>');
    const open = vi.fn();
    const registry = new DiagramRegistry(new App(), {
      getTrigger: () => "single",
      showExpandButton: () => false
    }, open);
    registry.scan(root);
    host.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    host.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    host.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(open).not.toHaveBeenCalled();
  });

  it("mounts diagrams whose SVG is rendered asynchronously", async () => {
    const { root, host } = fixture(false);
    const open = vi.fn();
    const registry = new DiagramRegistry(new App(), {
      getTrigger: () => "single",
      showExpandButton: () => true
    }, open);
    registry.scan(root);
    host.innerHTML = '<svg viewBox="0 0 100 100"></svg>';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host.classList.contains("mermaid-lens-host")).toBe(true);
    expect(host.querySelector(".mermaid-lens-expand")).not.toBeNull();
    registry.disposeAll();
  });

  it("opens from the expand button regardless of trigger", () => {
    const { root, host } = fixture();
    const open = vi.fn();
    const registry = new DiagramRegistry(new App(), {
      getTrigger: () => "button",
      showExpandButton: () => true
    }, open);
    registry.scan(root);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    host.querySelector("button")!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledOnce();
  });

  it("refreshes trigger/button state and disposes all controls and listeners", () => {
    const { root, host } = fixture();
    let trigger: OpenTrigger = "double";
    let showButton = true;
    const open = vi.fn();
    const registry = new DiagramRegistry(new App(), {
      getTrigger: () => trigger,
      showExpandButton: () => showButton
    }, open);
    registry.scan(root);
    expect(host.dataset.mermaidLensTrigger).toBe("double");

    trigger = "single";
    showButton = false;
    registry.refresh([root]);
    expect(host.dataset.mermaidLensTrigger).toBe("single");
    expect(host.querySelector("button")).toBeNull();

    registry.dispose([root]);
    expect(host.classList.contains("mermaid-lens-host")).toBe(false);
    expect(host.dataset.mermaidLensTrigger).toBeUndefined();
    host.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(open).not.toHaveBeenCalled();
  });
});
