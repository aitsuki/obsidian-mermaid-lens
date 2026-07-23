import { readFile } from "node:fs/promises";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error("Usage: node scripts/extract-release-notes.mjs x.y.z");
}

const changelogPath = process.env.CHANGELOG_PATH ?? "CHANGELOG.md";
const changelog = await readFile(changelogPath, "utf8");
const escapedVersion = version.replace(/\./g, "\\.");
const heading = new RegExp(`^## \\[${escapedVersion}\\](?: - \\d{4}-\\d{2}-\\d{2})?\\s*$`, "m");
const headingMatch = heading.exec(changelog);
if (!headingMatch) throw new Error(`CHANGELOG.md is missing version ${version}`);

const contentStart = headingMatch.index + headingMatch[0].length;
const remaining = changelog.slice(contentStart);
const boundaryOffsets = [remaining.search(/^## /m), remaining.search(/^\[[^\]]+\]:/m)]
  .filter((offset) => offset >= 0);
const contentEnd = boundaryOffsets.length === 0
  ? changelog.length
  : contentStart + Math.min(...boundaryOffsets);
const notes = changelog.slice(contentStart, contentEnd).trim();
if (!notes) throw new Error(`CHANGELOG.md section ${version} is empty`);

const link = new RegExp(`^\\[${escapedVersion}\\]:\\s+(\\S+)\\s*$`, "m").exec(changelog);
if (!link) throw new Error(`CHANGELOG.md is missing the [${version}] comparison link`);
const previousVersion = /\/compare\/(.+?)\.\.\./.exec(link[1])?.[1];
const label = previousVersion ? `${previousVersion}...${version}` : version;

process.stdout.write(`${notes}\n\n**Full Changelog:** [${label}](${link[1]})\n`);
