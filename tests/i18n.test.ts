import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "./mocks/obsidian";
import { t } from "../src/i18n";

describe("i18n", () => {
  afterEach(() => setLanguage("zh-CN"));

  it("uses English by default and interpolates parameters", () => {
    setLanguage("en");
    expect(t("settings.actions.apply")).toBe("Apply and redraw");
    expect(t("notice.invalidConfig", { message: "bad JSON" }))
      .toBe("Invalid Mermaid configuration: bad JSON");
  });

  it("normalizes language codes and falls back to the base language", () => {
    setLanguage("ZH-cn");
    expect(t("viewer.zoomIn")).toBe("放大");

    setLanguage("zh-TW");
    expect(t("viewer.zoomOut")).toBe("缩小");
  });

  it("falls back to English for unsupported languages", () => {
    setLanguage("fr");
    expect(t("viewer.fit")).toBe("Fit to window");
  });

  it("preserves an unknown interpolation placeholder", () => {
    setLanguage("en");
    expect(t("notice.invalidConfig")).toContain("{{message}}");
  });
});
