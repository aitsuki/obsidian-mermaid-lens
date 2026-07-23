import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type { SettingDefinitionItem, TextAreaComponent } from "obsidian";
import { t } from "./i18n";
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
        name: t("settings.config.name"),
        desc: t("settings.config.desc"),
        aliases: [t("settings.config.aliasJson"), t("settings.config.aliasInitialize")],
        render: (setting) => this.renderConfigInput(setting)
      },
      {
        name: t("settings.actions.name"),
        desc: t("settings.actions.desc"),
        aliases: [t("settings.actions.apply"), t("settings.actions.reset")],
        render: (setting) => this.renderConfigActions(setting)
      },
      {
        name: t("settings.trigger.name"),
        desc: t("settings.trigger.desc"),
        aliases: [
          t("settings.trigger.aliasSingle"),
          t("settings.trigger.aliasDouble"),
          t("settings.trigger.aliasButton")
        ],
        render: (setting) => this.renderOpenTrigger(setting)
      },
      {
        name: t("settings.expandButton.name"),
        desc: t("settings.expandButton.desc"),
        aliases: [t("settings.expandButton.aliasLarge"), t("settings.expandButton.aliasViewer")],
        render: (setting) => this.renderExpandButtonToggle(setting)
      }
    ];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderLegacySetting(
      t("settings.config.name"),
      t("settings.config.desc"),
      (setting) => this.renderConfigInput(setting)
    );
    this.renderLegacySetting(
      t("settings.actions.name"),
      t("settings.actions.desc"),
      (setting) => this.renderConfigActions(setting)
    );
    this.renderLegacySetting(
      t("settings.trigger.name"),
      t("settings.trigger.desc"),
      (setting) => this.renderOpenTrigger(setting)
    );
    this.renderLegacySetting(
      t("settings.expandButton.name"),
      t("settings.expandButton.desc"),
      (setting) => this.renderExpandButtonToggle(setting)
    );
  }

  private renderLegacySetting(name: string, desc: string, render: (setting: Setting) => void): void {
    const setting = new Setting(this.containerEl).setName(name).setDesc(desc);
    render(setting);
  }

  private renderConfigInput(setting: Setting): void {
    setting.setClass("mermaid-lens-config-setting");
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
        .setButtonText(t("settings.actions.apply"))
        .setCta()
        .onClick(async () => {
          try {
            await this.plugin.applyConfig(this.draftConfig);
            new Notice(t("notice.configApplied"));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            new Notice(t("notice.invalidConfig", { message }));
          }
        }))
      .addButton((button) => button
        .setButtonText(t("settings.actions.reset"))
        .onClick(async () => {
          try {
            await this.plugin.applyConfig(DEFAULT_SETTINGS.configJson);
            this.draftConfig = DEFAULT_SETTINGS.configJson;
            this.configInput?.setValue(this.draftConfig);
            new Notice(t("notice.defaultsRestored"));
          } catch (error) {
            console.error("[mermaid-lens] Failed to restore default config", error);
            new Notice(t("notice.restoreDefaultsFailed"));
          }
        }));
  }

  private renderOpenTrigger(setting: Setting): void {
    setting.addDropdown((dropdown) => dropdown
      .addOption("single", t("settings.trigger.single"))
      .addOption("double", t("settings.trigger.double"))
      .addOption("button", t("settings.trigger.button"))
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
