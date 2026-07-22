import assert from "node:assert/strict";
import test from "node:test";
import { mergeConfig, parseConfigJson } from "../src/config-utils";

test("mergeConfig deeply merges diagram settings and lets custom values win", () => {
  const result = mergeConfig(
    { theme: "dark", sequence: { actorMargin: 20, mirrorActors: false }, securityLevel: "strict" },
    { theme: "base", sequence: { actorMargin: 40 } }
  );
  assert.deepEqual(result, {
    theme: "base",
    sequence: { actorMargin: 40, mirrorActors: false },
    securityLevel: "strict"
  });
});

test("mergeConfig replaces arrays instead of merging indexes", () => {
  assert.deepEqual(mergeConfig({ values: [1, 2] }, { values: [3] }), { values: [3] });
});

test("mergeConfig ignores prototype-pollution keys", () => {
  const malicious = JSON.parse('{"__proto__":{"polluted":true},"theme":"base"}') as Record<string, unknown>;
  const result = mergeConfig({}, malicious);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "__proto__"), false);
});

test("parseConfigJson accepts objects and rejects other JSON values", () => {
  assert.deepEqual(parseConfigJson('{"theme":"base"}'), { theme: "base" });
  for (const value of ["null", "[]", '"base"', "1"]) {
    assert.throws(() => parseConfigJson(value), /JSON 对象/);
  }
});
