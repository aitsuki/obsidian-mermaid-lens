import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  App,
  ButtonComponent,
  DropdownComponent,
  notices,
  settingComponents,
  TextAreaComponent,
  ToggleComponent
} from "obsidian";
import { DEFAULT_SETTINGS, MermaidLensSettingTab, normalizeSettings } from "../src/settings";

describe("normalizeSettings", () => {
  it("uses defaults for null, missing, and invalid values", () => {
    expect(DEFAULT_SETTINGS.openTrigger).toBe("single");
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ openTrigger: "invalid" as never, configJson: 1 as never, showExpandButton: "yes" as never }))
      .toEqual(DEFAULT_SETTINGS);
  });

  it.each(["single", "double", "button"] as const)("accepts the %s trigger", (openTrigger) => {
    expect(normalizeSettings({ configJson: "{}", openTrigger, showExpandButton: false })).toEqual({
      configJson: "{}",
      openTrigger,
      showExpandButton: false
    });
  });
});

describe("MermaidLensSettingTab", () => {
  beforeEach(() => {
    settingComponents.length = 0;
    notices.length = 0;
    vi.restoreAllMocks();
  });

  function display() {
    const plugin = {
      settings: { ...DEFAULT_SETTINGS },
      applyConfig: vi.fn().mockResolvedValue(undefined),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      refreshDiagramControls: vi.fn()
    };
    const tab = new MermaidLensSettingTab(new App(), plugin as never);
    tab.display();
    return { plugin, tab };
  }

  it("applies the edited draft and reports success", async () => {
    const { plugin, tab } = display();
    const text = settingComponents[0] as TextAreaComponent;
    const apply = settingComponents[1] as ButtonComponent;
    await text.onChangeHandler?.('{"theme":"forest"}');
    await apply.onClickHandler?.();
    expect(plugin.applyConfig).toHaveBeenCalledWith('{"theme":"forest"}');
    expect(notices).toContain("Mermaid 配置已应用");
    expect(tab.containerEl.querySelector("h2")?.textContent).toBe("Mermaid Lens");
  });

  it("reports apply and reset failures and can restore defaults", async () => {
    const { plugin } = display();
    const apply = settingComponents[1] as ButtonComponent;
    const reset = settingComponents[2] as ButtonComponent;
    plugin.applyConfig.mockRejectedValueOnce(new Error("bad JSON"));
    await apply.onClickHandler?.();
    expect(notices).toContain("Mermaid 配置无效：bad JSON");

    plugin.applyConfig.mockResolvedValueOnce(undefined);
    await reset.onClickHandler?.();
    expect(plugin.applyConfig).toHaveBeenLastCalledWith(DEFAULT_SETTINGS.configJson);
    expect(notices).toContain("已恢复默认 Mermaid 配置");

    const nextReset = settingComponents.at(-3) as ButtonComponent;
    plugin.applyConfig.mockRejectedValueOnce(new Error("failed"));
    await nextReset.onClickHandler?.();
    expect(notices).toContain("恢复默认配置失败，请查看开发者控制台");
  });

  it("persists trigger and button changes and refreshes controls", async () => {
    const { plugin } = display();
    const dropdown = settingComponents[3] as DropdownComponent;
    const toggle = settingComponents[4] as ToggleComponent;
    await dropdown.onChangeHandler?.("single");
    await toggle.onChangeHandler?.(false);
    expect(plugin.settings.openTrigger).toBe("single");
    expect(plugin.settings.showExpandButton).toBe(false);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(2);
    expect(plugin.refreshDiagramControls).toHaveBeenCalledTimes(2);
  });
});
