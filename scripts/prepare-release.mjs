import { spawnSync } from "node:child_process";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error("Usage: npm run release -- x.y.z");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return result;
}

function output(command, args) {
  return run(command, args, { capture: true }).stdout.trim();
}

if (output("git", ["branch", "--show-current"]) !== "main") {
  throw new Error("Releases must be prepared from the main branch");
}
if (output("git", ["status", "--porcelain"]) !== "") {
  throw new Error("Working tree must be clean before preparing a release");
}
if (run("git", ["rev-parse", "--verify", `refs/tags/${version}`], { capture: true, allowFailure: true }).status === 0) {
  throw new Error(`Tag ${version} already exists`);
}

const node = process.execPath;
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this command through npm");
run(node, ["scripts/prepare-changelog.mjs", version]);
run(node, ["scripts/set-version.mjs", version]);
run(node, ["scripts/extract-release-notes.mjs", version], { capture: true });
run(node, [npmCli, "run", "lint"]);
run(node, [npmCli, "run", "test:coverage"]);
run(node, [npmCli, "run", "build"]);

run("git", ["add", "CHANGELOG.md", "package.json", "package-lock.json", "manifest.json", "versions.json"]);
const hasVersionChanges = run("git", ["diff", "--cached", "--quiet"], { capture: true, allowFailure: true }).status !== 0;
if (hasVersionChanges) {
  run("git", ["commit", "-m", `chore: release ${version}`]);
}
run("git", ["tag", "-a", version, "-m", version]);

console.log(`\nPrepared ${version}. Publish it with:`);
console.log(`git push --atomic origin main refs/tags/${version}`);
