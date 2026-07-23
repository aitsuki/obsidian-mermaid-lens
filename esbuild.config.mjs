import esbuild from "esbuild";
import process from "process";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { builtinModules } from "node:module";

const production = process.argv[2] === "production";
const outputDir = "dist";

if (production) {
  await rm(outputDir, { recursive: true, force: true });
}
await mkdir(outputDir, { recursive: true });
await Promise.all([
  copyFile("manifest.json", `${outputDir}/manifest.json`),
  copyFile("styles.css", `${outputDir}/styles.css`)
]);

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/autocomplete", "@codemirror/collab", "@codemirror/commands", "@codemirror/language", "@codemirror/lint", "@codemirror/search", "@codemirror/state", "@codemirror/view", "@lezer/common", "@lezer/highlight", "@lezer/lr", ...builtinModules, ...builtinModules.map((module) => `node:${module}`)],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: `${outputDir}/main.js`
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
