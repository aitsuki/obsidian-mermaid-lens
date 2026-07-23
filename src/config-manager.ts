import { loadMermaid } from "obsidian";
import { MermaidConfig, mergeConfig } from "./config-utils";

export { parseConfigJson } from "./config-utils";

export interface MermaidApi {
  initialize: (config: MermaidConfig) => void;
  getConfig?: () => MermaidConfig;
}

type MermaidLoader = () => Promise<MermaidApi>;

async function loadObsidianMermaid(): Promise<MermaidApi> {
  const loaded: unknown = await loadMermaid();
  if (loaded === null || typeof loaded !== "object" || !("initialize" in loaded)
    || typeof loaded.initialize !== "function") {
    throw new Error("Obsidian returned an invalid Mermaid API");
  }
  return loaded as MermaidApi;
}

/**
 * Wraps Obsidian's shared Mermaid instance. The wrapper becomes a transparent
 * pass-through after dispose, even when another plugin wrapped it afterwards.
 */
export class MermaidConfigManager {
  private readonly load: MermaidLoader;
  private api?: MermaidApi;
  private originalInitialize?: MermaidApi["initialize"];
  private wrapper?: MermaidApi["initialize"];
  private baseConfig: MermaidConfig = {};
  private customConfig: MermaidConfig = {};
  private active = false;

  constructor(load: MermaidLoader = loadObsidianMermaid) {
    this.load = load;
  }

  async install(config: MermaidConfig): Promise<void> {
    if (this.active) {
      this.apply(config);
      return;
    }

    const api = await this.load();
    const original = api.initialize;
    this.api = api;
    this.originalInitialize = original;
    this.baseConfig = this.readCurrentConfig(api);
    this.customConfig = config;
    this.active = true;

    const wrapper = (incoming: MermaidConfig): void => {
      const nextBase = incoming !== null && typeof incoming === "object" && !Array.isArray(incoming)
        ? incoming
        : {};
      if (!this.active) {
        original(nextBase);
        return;
      }
      this.baseConfig = nextBase;
      original(mergeConfig(nextBase, this.customConfig));
    };
    this.wrapper = wrapper;
    api.initialize = wrapper;

    try {
      original(mergeConfig(this.baseConfig, config));
    } catch (error) {
      this.active = false;
      if (api.initialize === wrapper) api.initialize = original;
      this.clearReferences();
      throw error;
    }
  }

  apply(config: MermaidConfig): void {
    if (!this.api || !this.originalInitialize || !this.active) {
      throw new Error("Mermaid 配置管理器尚未初始化");
    }

    const previous = this.customConfig;
    try {
      this.originalInitialize(mergeConfig(this.baseConfig, config));
      this.customConfig = config;
    } catch (error) {
      try {
        this.originalInitialize(mergeConfig(this.baseConfig, previous));
      } catch (restoreError) {
        console.error("[mermaid-lens] Failed to restore Mermaid config", restoreError);
      }
      throw error;
    }
  }

  dispose(): void {
    const api = this.api;
    const original = this.originalInitialize;
    const wrapper = this.wrapper;
    this.active = false;

    if (api && original) {
      if (wrapper && api.initialize === wrapper) api.initialize = original;
      try {
        original(this.baseConfig);
      } catch (error) {
        console.error("[mermaid-lens] Failed to restore Obsidian Mermaid config", error);
      }
    }
    this.clearReferences();
  }

  private readCurrentConfig(api: MermaidApi): MermaidConfig {
    try {
      const config = api.getConfig?.();
      return config !== null && typeof config === "object" && !Array.isArray(config) ? config : {};
    } catch {
      return {};
    }
  }

  private clearReferences(): void {
    this.api = undefined;
    this.originalInitialize = undefined;
    this.wrapper = undefined;
    this.baseConfig = {};
    this.customConfig = {};
  }
}
