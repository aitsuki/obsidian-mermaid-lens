import { getLanguage } from "obsidian";
import { en } from "./locales/en";
import type { TranslationKey } from "./locales/en";
import { zhCN } from "./locales/zh-cn";

type TranslationParams = Record<string, string | number>;
type Translations = Record<TranslationKey, string>;

const translations: Record<string, Translations> = {
  en,
  zh: zhCN,
  "zh-cn": zhCN
};

export function t(key: TranslationKey, params: TranslationParams = {}): string {
  const language = getLanguage().toLowerCase();
  const messages = translations[language]
    ?? translations[language.split("-")[0]]
    ?? en;
  return messages[key].replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
