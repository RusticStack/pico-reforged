import assert from "node:assert/strict";
import { execFileSync, execSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterAll, onTestFinished, test } from "vite-plus/test";
import { fileURLToPath } from "node:url";
import { EXTRAS, matrixNames } from "../../scripts/lib/compiler/index.ts";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), "pico-cli-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const run = (script: string, args: string[], cwd = root) =>
  spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });

const ORDER = ["pico.tokens", "pico.theme", "pico.core", "pico.extras", "pico.utilities"];

// The order in which layer names first appear (same helper as in extras.test.ts).
function layerOrder(css: string): string[] {
  const seen: string[] = [];
  for (const m of css.matchAll(/@layer\s+([\w.,\s]+?)\s*[;{]/g)) {
    for (const name of (m[1] as string).split(",")) {
      if (!seen.includes(name.trim())) seen.push(name.trim());
    }
  }
  return seen;
}

test("themes lists the 20 themes", () => {
  const out = run("scripts/cli.ts", ["themes"]);
  assert.equal(out.status, 0);
  const names = out.stdout.trim().split(/\r?\n/);
  assert.equal(names.length, 20);
  assert.ok(names.includes("azure") && names.includes("zinc"));
});

test("build writes a file and prints a size line", () => {
  const out = join(dir, "lean.css");
  const res = run("scripts/cli.ts", [
    "build",
    "--entry",
    "classless",
    "--scope",
    ".pico",
    "--fluid",
    "--exclude",
    "components/modal,forms/input-range",
    "--minify",
    "--out",
    out,
  ]);
  assert.equal(res.status, 0, res.stderr);
  const css = readFileSync(out, "utf8");
  assert.match(css, /@layer/);
  assert.match(css, /\.pico body ?> ?(main|:is\([^)]*\bmain\b)/);
  assert.doesNotMatch(css, /dialog>article/);
  assert.match(res.stderr, /excluded/);
});

test("build prints to stdout without --out", () => {
  const res = run("scripts/cli.ts", ["build", "--entry", "colors"]);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /\.pico-color-azure/);
});

test("build reads a JSON config and flags win over it", () => {
  const config = join(dir, "pico.config.json");
  writeFileSync(config, JSON.stringify({ entry: "classless", theme: "jade", scope: ".site" }));
  const a = run("scripts/cli.ts", ["build", "--config", config, "--minify"]);
  assert.equal(a.status, 0, a.stderr);
  assert.match(a.stdout, /\.site body/);
  const b = run("scripts/cli.ts", ["build", "--config", config, "--scope", ".other", "--minify"]);
  assert.match(b.stdout, /\.other body/);
  assert.doesNotMatch(b.stdout, /\.site/);
});

test("build reads a .ts config", () => {
  const config = join(dir, "custom.config.ts");
  writeFileSync(config, `export default { entry: "classless", scope: ".ts-scope" };\n`);
  const res = run("scripts/cli.ts", ["build", "--config", config]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /\.ts-scope body/);
});

test("build with --purge", () => {
  const html = join(dir, "page.html");
  writeFileSync(html, "<main><p>Hi</p></main>");
  const res = run("scripts/cli.ts", ["build", "--purge", html]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr, /dropped by purge/);
  assert.doesNotMatch(res.stdout, /details\.dropdown/);
});

test("build --safelist reads /regex/ and adds to the config's purge block", () => {
  const html = join(dir, "safelist-page.html");
  writeFileSync(html, "<main><p>Hi</p></main>");
  const plain = run("scripts/cli.ts", ["build", "--purge", html]);
  assert.doesNotMatch(plain.stdout, /\.outline/);
  const regex = run("scripts/cli.ts", ["build", "--purge", html, "--safelist", "/^outl/"]);
  assert.equal(regex.status, 0, regex.stderr);
  assert.match(regex.stdout, /\.outline/);

  const config = join(dir, "purge.config.json");
  writeFileSync(config, JSON.stringify({ purge: { content: [html] } }));
  const fromConfig = run("scripts/cli.ts", ["build", "--config", config]);
  assert.doesNotMatch(fromConfig.stdout, /\.outline/);
  const merged = run("scripts/cli.ts", ["build", "--config", config, "--safelist", "/^outl/"]);
  assert.equal(merged.status, 0, merged.stderr);
  assert.match(merged.stdout, /\.outline/);
  assert.doesNotMatch(merged.stderr, /no effect/);

  const none = run("scripts/cli.ts", ["build", "--safelist", "outline"]);
  assert.match(none.stderr, /--safelist has no effect/);
});

test("matrix writes the v2.1.1 file names", () => {
  const out = join(dir, "matrix");
  const res = run("scripts/cli.ts", ["matrix", out]);
  assert.equal(res.status, 0, res.stderr);
  const files = readdirSync(out);
  // 238 v2.1.1 files, pico.extras(.min).css and the extras/ folder.
  assert.equal(files.length, 238 + 2 + 1);
  assert.equal(readdirSync(join(out, "extras")).length, 22);
  for (const name of [
    "pico.css",
    "pico.min.css",
    "pico.classless.amber.css",
    "pico.conditional.zinc.min.css",
    "pico.classless.conditional.jade.css",
    "pico.fluid.classless.min.css",
    "pico.fluid.classless.conditional.red.min.css",
    "pico.colors.css",
    "pico.colors.min.css",
  ]) {
    assert.ok(files.includes(name), `missing ${name}`);
  }
  assert.ok(!files.includes("pico.azure.css"));
  const text = readFileSync(join(out, "pico.min.css"), "utf8");
  const firstLine = text.split("\n")[0] as string;
  assert.match(firstLine, /^\/\*! Pico Reforged v\d\S* \| MIT \| Copyright 2026 rusticstack \| /);
  assert.ok(firstLine.endsWith("| Copyright 2019-2024 Lucas Larroche and the Pico CSS authors */"));
  const plain = readFileSync(join(out, "pico.css"), "utf8");
  assert.match(plain, /^\/\*!\n \* Pico Reforged v\d/);
  assert.match(plain, /Lucas Larroche/);
  assert.match(plain, /2026 rusticstack/);
  assert.match(plain, /https:\/\/pico\.rusticstack\.com/);

  // The extras files. This is the only full matrix build in the suite, so the extras checks of
  // the matrix live here too.
  const written = readdirSync(out, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(out, join(e.parentPath, e.name)).replaceAll("\\", "/"));
  assert.deepEqual(written.toSorted(), matrixNames().toSorted());
  const all = readFileSync(join(out, "pico.extras.css"), "utf8");
  assert.match(all, /^\/\*!\n \* Pico Reforged/);
  assert.deepEqual(layerOrder(all), ORDER);
  for (const extra of EXTRAS) {
    const own = readFileSync(join(out, "extras", `${extra}.css`), "utf8");
    assert.deepEqual(layerOrder(own), ORDER, extra);
  }
  // The default files never carry an extras block.
  for (const name of ["pico.css", "pico.classless.css", "pico.conditional.css"]) {
    assert.doesNotMatch(readFileSync(join(out, name), "utf8"), /@layer pico\.extras\s*\{/);
  }
}, 300_000);

test("unknown commands and themes fail", () => {
  assert.equal(run("scripts/cli.ts", ["wat"]).status, 2);
  const res = run("scripts/cli.ts", ["build", "--theme", "nope"]);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Unknown theme/);
});

test("the packed CLI runs as plain JavaScript", () => {
  // Packs into a git-ignored folder inside the repo, so the CLI still finds package.json and
  // src/ above it and the test leaves dist/ alone.
  const packDir = join(root, "dist-dev-pack");
  execSync("pnpm exec vp pack --out-dir dist-dev-pack", { cwd: root, stdio: "pipe" });
  onTestFinished(() => rmSync(packDir, { recursive: true, force: true }));
  const cli = join(packDir, "cli.js");
  assert.ok(existsSync(cli));
  const source = readFileSync(cli, "utf8");
  assert.ok(source.startsWith("#!/usr/bin/env node"));
  assert.doesNotMatch(source, /from "\.[^"]*\.ts"/);
  assert.ok(existsSync(join(packDir, "compiler.js")));
  assert.ok(existsSync(join(packDir, "compiler.d.ts")));

  // Run it without type stripping, the way Node treats code inside node_modules.
  const out = join(dir, "dist-build.css");
  const res = execFileSync(
    process.execPath,
    ["--no-experimental-strip-types", cli, "build", "--theme", "#e5484d", "--minify", "--out", out],
    { cwd: root, encoding: "utf8", stdio: "pipe" },
  );
  assert.equal(res, "");
  assert.match(readFileSync(out, "utf8"), /--pico-primary/);
  assert.equal(
    execFileSync(process.execPath, [cli, "--version"], { encoding: "utf8" }).trim(),
    (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }).version,
  );
}, 120_000);
