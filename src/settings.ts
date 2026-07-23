import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type MermaidLensPlugin from "./main";

export type OpenTrigger = "single" | "double" | "button";

export interface MermaidLensSettings {
  configJson: string;
  openTrigger: OpenTrigger;
  showExpandButton: boolean;
}

export const DEFAULT_CONFIG = {
  theme: "base",
  themeVariables: {
    fontFamily: "Inter, Microsoft YaHei, sans-serif",
    primaryColor: "#EEF2FF",
    primaryBorderColor: "#6366F1",
    primaryTextColor: "#1E293B",
    lineColor: "#64748B",
    signalColor: "#334155",
    signalTextColor: "#334155",
    actorBkg: "#6366F1",
    actorBorder: "#4F46E5",
    actorTextColor: "#FFFFFF",
    labelTextColor: "#FFFFFF",
    loopTextColor: "#334155",
    noteBkgColor: "#FEF3C7",
    noteBorderColor: "#F59E0B",
    noteTextColor: "#78350F"
  },
  sequence: {
    useMaxWidth: true,
    actorMargin: 40,
    messageMargin: 30,
    mirrorActors: true
  }
};

export const DEFAULT_SETTINGS: MermaidLensSettings = {
  configJson: JSON.stringify(DEFAULT_CONFIG, null, 2),
  openTrigger: "single",
  showExpandButton: true
};

export function normalizeSettings(value: Partial<MermaidLensSettings> | null): MermaidLensSettings {
  const trigger = value?.openTrigger;
  return {
    configJson: typeof value?.configJson === "string" ? value.configJson : DEFAULT_SETTINGS.configJson,
    openTrigger: trigger === "single" || trigger === "double" || trigger === "button"
      ? trigger
      : DEFAULT_SETTINGS.openTrigger,
    showExpandButton: typeof value?.showExpandButton === "boolean"
      ? value.showExpandButton
      : DEFAULT_SETTINGS.showExpandButton
  };
}

export class MermaidLensSettingTab extends PluginSettingTab {
  private readonly plugin: MermaidLensPlugin;
  private draftConfig = "";

  constructor(app: App, plugin: MermaidLensPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    this.draftConfig = this.plugin.settings.configJson;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Mermaid Lens" });

    new Setting(containerEl)
      .setName("全局 Mermaid 配置")
      .setDesc("填写 Mermaid initialize() 使用的 JSON。只有点击“应用并重绘”后才会保存。")
      .addTextArea((text) => {
        text
          .setValue(this.draftConfig)
          .setPlaceholder("{\n  \"theme\": \"base\"\n}")
          .onChange((value) => {
            this.draftConfig = value;
          });
        text.inputEl.rows = 24;
        text.inputEl.addClass("mermaid-lens-config-input");
      });

    new Setting(containerEl)
      .setName("应用配置")
      .setDesc("验证配置；Mermaid 接受后才保存并重绘。")
      .addButton((button) => button
        .setButtonText("应用并重绘")
        .setCta()
        .onClick(async () => {
          try {
            await this.plugin.applyConfig(this.draftConfig);
            new Notice("Mermaid 配置已应用");
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            new Notice(`Mermaid 配置无效：${message}`);
          }
        }))
      .addButton((button) => button
        .setButtonText("恢复默认配置")
        .onClick(async () => {
          try {
            await this.plugin.applyConfig(DEFAULT_SETTINGS.configJson);
            this.display();
            new Notice("已恢复默认 Mermaid 配置");
          } catch (error) {
            console.error("[mermaid-lens] Failed to restore default config", error);
            new Notice("恢复默认配置失败，请查看开发者控制台");
          }
        }));

    new Setting(containerEl)
      .setName("打开大图的操作")
      .setDesc("默认单击打开；图中的链接和按钮不会触发大图。")
      .addDropdown((dropdown) => dropdown
        .addOption("single", "单击图表")
        .addOption("double", "双击图表")
        .addOption("button", "仅使用展开按钮")
        .setValue(this.plugin.settings.openTrigger)
        .onChange(async (value) => {
          this.plugin.settings.openTrigger = value as OpenTrigger;
          await this.plugin.saveSettings();
          this.plugin.refreshDiagramControls();
        }));

    new Setting(containerEl)
      .setName("显示展开按钮")
      .setDesc("在 Mermaid 图右上角显示展开按钮。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showExpandButton)
        .onChange(async (value) => {
          this.plugin.settings.showExpandButton = value;
          await this.plugin.saveSettings();
          this.plugin.refreshDiagramControls();
        }));
  }
}
