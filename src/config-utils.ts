export type MermaidConfig = Record<string, unknown>;

const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isPlainObject(value: unknown): value is MermaidConfig {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function mergeConfig(base: MermaidConfig, override: MermaidConfig): MermaidConfig {
  const result: MermaidConfig = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (BLOCKED_KEYS.has(key)) continue;
    const previous = result[key];
    result[key] = isPlainObject(previous) && isPlainObject(value)
      ? mergeConfig(previous, value)
      : value;
  }
  return result;
}

export function parseConfigJson(value: string): MermaidConfig {
  const parsed: unknown = JSON.parse(value);
  if (!isPlainObject(parsed)) throw new Error("配置必须是 JSON 对象");
  return parsed;
}
