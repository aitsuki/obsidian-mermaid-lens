import { beforeEach, describe, expect, it, vi } from "vitest";
import { MermaidApi, MermaidConfigManager } from "../src/config-manager";
import type { MermaidConfig } from "../src/config-utils";

function fakeApi(base: MermaidConfig = { theme: "dark", sequence: { mirrorActors: false } }) {
  const calls: MermaidConfig[] = [];
  const api: MermaidApi = {
    getConfig: vi.fn(() => base),
    initialize: vi.fn((config) => { calls.push(config); })
  };
  return { api, calls, original: api.initialize };
}

describe("MermaidConfigManager", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("installs over the current config and wraps future initialize calls", async () => {
    const { api, calls, original } = fakeApi();
    const manager = new MermaidConfigManager(async () => api);
    await manager.install({ theme: "base", sequence: { actorMargin: 40 } });

    expect(calls[0]).toEqual({ theme: "base", sequence: { mirrorActors: false, actorMargin: 40 } });
    expect(api.initialize).not.toBe(original);

    api.initialize({ theme: "forest", flowchart: { curve: "basis" } });
    expect(calls[1]).toEqual({
      theme: "base",
      flowchart: { curve: "basis" },
      sequence: { actorMargin: 40 }
    });
  });

  it("treats a repeated install as apply without loading Mermaid again", async () => {
    const { api, calls } = fakeApi();
    const load = vi.fn(async () => api);
    const manager = new MermaidConfigManager(load);
    await manager.install({ theme: "base" });
    await manager.install({ theme: "forest" });
    expect(load).toHaveBeenCalledOnce();
    expect(calls.at(-1)).toEqual({ theme: "forest", sequence: { mirrorActors: false } });
  });

  it("rolls back the previous custom config when apply fails", async () => {
    const calls: MermaidConfig[] = [];
    const api: MermaidApi = {
      getConfig: () => ({ securityLevel: "strict" }),
      initialize(config) {
        calls.push(config);
        if (config.theme === "broken") throw new Error("invalid theme");
      }
    };
    const manager = new MermaidConfigManager(async () => api);
    await manager.install({ theme: "base" });
    expect(() => manager.apply({ theme: "broken" })).toThrow("invalid theme");
    expect(calls.at(-1)).toEqual({ securityLevel: "strict", theme: "base" });
  });

  it("reports apply before installation", () => {
    expect(() => new MermaidConfigManager().apply({})).toThrow(/尚未初始化/);
  });

  it("restores the wrapper and clears state after initial initialization fails", async () => {
    const original = vi.fn(() => { throw new Error("bad config"); });
    const api: MermaidApi = { initialize: original, getConfig: () => ({ theme: "dark" }) };
    const manager = new MermaidConfigManager(async () => api);
    await expect(manager.install({ theme: "broken" })).rejects.toThrow("bad config");
    expect(api.initialize).toBe(original);
    expect(() => manager.apply({})).toThrow(/尚未初始化/);
  });

  it("restores the base config on dispose", async () => {
    const { api, calls, original } = fakeApi({ theme: "dark" });
    const manager = new MermaidConfigManager(async () => api);
    await manager.install({ theme: "base" });
    manager.dispose();
    expect(api.initialize).toBe(original);
    expect(calls.at(-1)).toEqual({ theme: "dark" });
  });

  it("becomes a pass-through when another plugin wraps it later", async () => {
    const { api, calls } = fakeApi();
    const manager = new MermaidConfigManager(async () => api);
    await manager.install({ theme: "base" });
    const ours = api.initialize;
    api.initialize = (config) => ours({ ...config, otherPlugin: true });

    manager.dispose();
    api.initialize({ theme: "forest" });
    expect(calls.at(-1)).toEqual({ theme: "forest", otherPlugin: true });
  });

  it.each([
    undefined,
    () => null as never,
    () => [] as never,
    () => { throw new Error("unavailable"); }
  ])("uses an empty base when getConfig is missing or invalid", async (getConfig) => {
    const calls: MermaidConfig[] = [];
    const api: MermaidApi = { initialize: (config) => { calls.push(config); }, getConfig };
    await new MermaidConfigManager(async () => api).install({ theme: "base" });
    expect(calls[0]).toEqual({ theme: "base" });
  });
});
