import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, MarkdownView, notices } from "./mocks/obsidian";
import MermaidLensPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/settings";

function workspace(views: unknown[] = []) {
  return {
    iterateAllLeaves(callback: (leaf: { view: unknown }) => void) {
      for (const view of views) callback({ view });
    },
    on: vi.fn(() => ({})),
    onLayoutReady: vi.fn()
  };
}

function pluginWithWorkspace(views: unknown[] = []) {
  const plugin = new MermaidLensPlugin(new App() as never, {} as never) as MermaidLensPlugin & { app: any };
  plugin.app.workspace = workspace(views);
  return plugin;
}

describe("MermaidLensPlugin", () => {
  beforeEach(() => {
    notices.length = 0;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("loads and normalizes saved settings", async () => {
    const plugin = pluginWithWorkspace();
    vi.spyOn(plugin, "loadData").mockResolvedValue({ openTrigger: "single" });
    await plugin.loadSettings();
    expect(plugin.settings.openTrigger).toBe("single");
    expect(plugin.settings.showExpandButton).toBe(true);
  });

  it("applies, saves, rerenders, scans, and schedules follow-up scans", async () => {
    vi.useFakeTimers();
    const plugin = pluginWithWorkspace();
    const manager = { apply: vi.fn(), dispose: vi.fn() };
    (plugin as any).configManager = manager;
    const save = vi.spyOn(plugin, "saveSettings").mockResolvedValue();
    const rerender = vi.spyOn(plugin as any, "rerenderOpenMarkdownViews");
    const scan = vi.spyOn(plugin as any, "scanOpenViews");
    const scheduled = vi.spyOn(plugin as any, "scheduleScanOpenViews");

    await plugin.applyConfig('{"theme":"forest"}');
    expect(manager.apply).toHaveBeenCalledWith({ theme: "forest" });
    expect(save).toHaveBeenCalledOnce();
    expect(plugin.settings.configJson).toBe('{"theme":"forest"}');
    expect(rerender).toHaveBeenCalledOnce();
    expect(scan).toHaveBeenCalledOnce();
    expect(scheduled.mock.calls.map((call: unknown[]) => call[0])).toEqual([50, 250, 750]);
  });

  it("rolls settings and active Mermaid config back when persistence fails", async () => {
    const plugin = pluginWithWorkspace();
    plugin.settings = { ...DEFAULT_SETTINGS, configJson: '{"theme":"dark"}' };
    (plugin as any).activeConfigJson = '{"theme":"base"}';
    const manager = { apply: vi.fn(), dispose: vi.fn() };
    (plugin as any).configManager = manager;
    vi.spyOn(plugin, "saveSettings").mockRejectedValue(new Error("disk full"));

    await expect(plugin.applyConfig('{"theme":"forest"}')).rejects.toThrow("disk full");
    expect(plugin.settings.configJson).toBe('{"theme":"dark"}');
    expect(manager.apply.mock.calls).toEqual([[{ theme: "forest" }], [{ theme: "base" }]]);
  });

  it("rerenders only Mermaid views and preserves source-mode editor state", () => {
    const preview = Object.assign(new MarkdownView(), {
      containerEl: document.createElement("div"),
      getMode: () => "preview",
      previewMode: { rerender: vi.fn() }
    });
    preview.containerEl.innerHTML = '<div class="mermaid"></div>';
    const editor = {
      getCursor: vi.fn(() => ({ line: 2, ch: 3 })),
      getScrollInfo: vi.fn(() => ({ left: 10, top: 20 })),
      setCursor: vi.fn(),
      scrollTo: vi.fn()
    };
    const source = Object.assign(new MarkdownView(), {
      containerEl: document.createElement("div"),
      getMode: () => "source",
      getViewData: () => "markdown",
      setViewData: vi.fn(),
      editor
    });
    source.containerEl.innerHTML = '<div class="mermaid-preview"></div>';
    const plain = Object.assign(new MarkdownView(), { containerEl: document.createElement("div") });
    const plugin = pluginWithWorkspace([preview, source, plain]);

    (plugin as any).rerenderOpenMarkdownViews();
    expect(preview.previewMode.rerender).toHaveBeenCalledWith(true);
    expect(source.setViewData).toHaveBeenCalledWith("markdown", false);
    expect(editor.setCursor).toHaveBeenCalledWith({ line: 2, ch: 3 });
    expect(editor.scrollTo).toHaveBeenCalledWith(10, 20);
  });

  it("falls back to defaults when saved JSON is invalid", async () => {
    const plugin = pluginWithWorkspace();
    vi.spyOn(plugin, "loadSettings").mockImplementation(async () => {
      plugin.settings = { ...DEFAULT_SETTINGS, configJson: "{" };
    });
    const manager = { install: vi.fn().mockResolvedValue(undefined), apply: vi.fn(), dispose: vi.fn() };
    (plugin as any).configManager = manager;
    await plugin.onload();
    expect(manager.install).toHaveBeenCalledWith(JSON.parse(DEFAULT_SETTINGS.configJson));
    expect(notices).toContain("保存的 Mermaid 配置无效，本次使用默认配置");
  });

  it("retries defaults if Mermaid rejects the saved config", async () => {
    const plugin = pluginWithWorkspace();
    vi.spyOn(plugin, "loadSettings").mockResolvedValue();
    const manager = {
      install: vi.fn().mockRejectedValueOnce(new Error("rejected")).mockResolvedValueOnce(undefined),
      apply: vi.fn(),
      dispose: vi.fn()
    };
    (plugin as any).configManager = manager;
    await plugin.onload();
    expect(manager.install).toHaveBeenCalledTimes(2);
    expect(notices).toContain("Mermaid 配置无法应用，已尝试恢复默认配置");
  });

  it("clears timers and disposes collaborators on unload", () => {
    vi.useFakeTimers();
    const plugin = pluginWithWorkspace();
    const manager = { dispose: vi.fn() };
    const registry = { dispose: vi.fn(), disposeAll: vi.fn() };
    (plugin as any).configManager = manager;
    (plugin as any).registry = registry;
    (plugin as any).loaded = true;
    (plugin as any).scheduleScanOpenViews(100);
    plugin.onunload();
    expect(vi.getTimerCount()).toBe(0);
    expect(registry.dispose).toHaveBeenCalled();
    expect(registry.disposeAll).toHaveBeenCalled();
    expect(manager.dispose).toHaveBeenCalled();
  });
});
