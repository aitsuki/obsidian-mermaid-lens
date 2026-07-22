import { describe, expect, it } from "vitest";
import { mergeConfig, parseConfigJson } from "../src/config-utils";

describe("mergeConfig", () => {
  it("deeply merges settings and lets custom values win without mutating inputs", () => {
    const base = { theme: "dark", sequence: { actorMargin: 20, mirrorActors: false }, securityLevel: "strict" };
    const override = { theme: "base", sequence: { actorMargin: 40 } };
    expect(mergeConfig(base, override)).toEqual({
      theme: "base",
      sequence: { actorMargin: 40, mirrorActors: false },
      securityLevel: "strict"
    });
    expect(base.sequence.actorMargin).toBe(20);
    expect(override.sequence).toEqual({ actorMargin: 40 });
  });

  it("replaces arrays, null, and scalar values instead of merging them", () => {
    expect(mergeConfig({ values: [1, 2], nested: { ok: true }, scalar: 1 }, {
      values: [3], nested: null, scalar: { deep: true }
    })).toEqual({ values: [3], nested: null, scalar: { deep: true } });
  });

  it("ignores prototype-pollution keys at every depth", () => {
    const malicious = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{},"nested":{"prototype":{},"safe":true}}'
    ) as Record<string, unknown>;
    const result = mergeConfig({ nested: {} }, malicious);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, "constructor")).toBe(false);
    expect(result).toEqual({ nested: { safe: true } });
  });
});

describe("parseConfigJson", () => {
  it("accepts objects, including an empty object", () => {
    expect(parseConfigJson('{"theme":"base"}')).toEqual({ theme: "base" });
    expect(parseConfigJson("{}")).toEqual({});
  });

  it.each(["null", "[]", '"base"', "1"])("rejects non-object JSON: %s", (value) => {
    expect(() => parseConfigJson(value)).toThrow(/JSON 对象/);
  });

  it("reports malformed JSON", () => {
    expect(() => parseConfigJson("{")).toThrow(SyntaxError);
  });
});
