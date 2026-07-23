import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type { SettingDefinitionItem, TextAreaComponent } from "obsidian";
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
  private configInput?: TextAreaComponent;

  constructor(app: App, plugin: MermaidLensPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "全局 Mermaid 配置",
        desc: "填写 Mermaid initialize() 使用的 JSON。只有点击“应用并重绘”后才会保存。",
        aliases: ["Mermaid JSON", "initialize"],
        render: (setting) => this.renderConfigInput(setting)
      },
      {
        name: "应用配置",
        desc: "验证配置；Mermaid 接受后才保存并重绘。",
        aliases: ["应用并重绘", "恢复默认配置"],
        render: (setting) => this.renderConfigActions(setting)
      },
      {
        name: "打开大图的操作",
        desc: "默认单击打开；图中的链接和按钮不会触发大图。",
        aliases: ["单击图表", "双击图表", "展开按钮"],
        render: (setting) => this.renderOpenTrigger(setting)
      },
      {
        name: "显示展开按钮",
        desc: "在 Mermaid 图右上角显示展开按钮。",
        aliases: ["大图", "查看器"],
        render: (setting) => this.renderExpandButtonToggle(setting)
      }
    ];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderLegacySetting(
      "全局 Mermaid 配置",
      "填写 Mermaid initialize() 使用的 JSON。只有点击“应用并重绘”后才会保存。",
      (setting) => this.renderConfigInput(setting)
    );
    this.renderLegacySetting(
      "应用配置",
      "验证配置；Mermaid 接受后才保存并重绘。",
      (setting) => this.renderConfigActions(setting)
    );
    this.renderLegacySetting(
      "打开大图的操作",
      "默认单击打开；图中的链接和按钮不会触发大图。",
      (setting) => this.renderOpenTrigger(setting)
    );
    this.renderLegacySetting(
      "显示展开按钮",
      "在 Mermaid 图右上角显示展开按钮。",
      (setting) => this.renderExpandButtonToggle(setting)
    );
  }

  private renderLegacySetting(name: string, desc: string, render: (setting: Setting) => void): void {
    const setting = new Setting(this.containerEl).setName(name).setDesc(desc);
    render(setting);
  }

  private renderConfigInput(setting: Setting): void {
    this.draftConfig = this.plugin.settings.configJson;
    setting.addTextArea((text) => {
      this.configInput = text;
      text
        .setValue(this.draftConfig)
        .setPlaceholder("{\n  \"theme\": \"base\"\n}")
        .onChange((value) => {
          this.draftConfig = value;
        });
      text.inputEl.rows = 24;
      text.inputEl.addClass("mermaid-lens-config-input");
    });
  }

  private renderConfigActions(setting: Setting): void {
    setting
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
            this.draftConfig = DEFAULT_SETTINGS.configJson;
            this.configInput?.setValue(this.draftConfig);
            new Notice("已恢复默认 Mermaid 配置");
          } catch (error) {
            console.error("[mermaid-lens] Failed to restore default config", error);
            new Notice("恢复默认配置失败，请查看开发者控制台");
          }
        }));
  }

  private renderOpenTrigger(setting: Setting): void {
    setting.addDropdown((dropdown) => dropdown
      .addOption("single", "单击图表")
      .addOption("double", "双击图表")
      .addOption("button", "仅使用展开按钮")
      .setValue(this.plugin.settings.openTrigger)
      .onChange(async (value) => {
        this.plugin.settings.openTrigger = value as OpenTrigger;
        await this.plugin.saveSettings();
        this.plugin.refreshDiagramControls();
      }));
  }

  private renderExpandButtonToggle(setting: Setting): void {
    setting.addToggle((toggle) => toggle
      .setValue(this.plugin.settings.showExpandButton)
      .onChange(async (value) => {
        this.plugin.settings.showExpandButton = value;
        await this.plugin.saveSettings();
        this.plugin.refreshDiagramControls();
      }));
  }
}
