import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vite-plus/test";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const cli = join(root, "scripts", "cli.ts");
const dir = mkdtempSync(join(tmpdir(), "pico-cli-args-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const run = (args: string[], cwd = root) =>
  spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });

test("--help after a command prints the help and builds nothing", () => {
  const cwd = join(dir, "help");
  mkdirSync(cwd);
  for (const args of [
    ["matrix", "--help"],
    ["matrix", "-h"],
    ["build", "--help"],
    ["build", "-h"],
    ["purge", "--help"],
  ]) {
    const res = run(args, cwd);
    assert.equal(res.status, 0, `${args.join(" ")}: ${res.stderr}`);
    assert.match(res.stdout, /^pico-reforged\n\nUsage/);
    assert.match(res.stdout, /--version, -v/);
  }
  assert.deepEqual(readdirSync(cwd), []);
});

test("matrix rejects unknown flags and extra folders", () => {
  const cwd = join(dir, "matrix");
  mkdirSync(cwd);
  const flag = run(["matrix", "--out", "x"], cwd);
  assert.equal(flag.status, 2);
  assert.match(flag.stderr, /--out/);
  assert.equal(run(["matrix", "a", "b"], cwd).status, 2);
  assert.deepEqual(readdirSync(cwd), []);
});

test("build --purge that reads no file fails and writes nothing", () => {
  const out = join(dir, "never.css");
  const res = run(["build", "--purge", join(dir, "nothing-here", "*.html"), "--out", out]);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /no content file matches/);
  assert.ok(!existsSync(out));
});

test("paths in a config file are relative to its folder", () => {
  const cfg = join(dir, "project", "config");
  mkdirSync(join(cfg, "my-extras"), { recursive: true });
  writeFileSync(join(cfg, "brand.css"), ":root { --pico-brand-marker: 1px; }");
  writeFileSync(join(cfg, "page.html"), `<main><p class="brand-page">x</p></main>`);
  writeFileSync(join(cfg, "my-extras", "tabs.css"), ".tabs-marker { color: red; }");
  writeFileSync(
    join(cfg, "pico.config.json"),
    JSON.stringify({
      theme: "./brand.css",
      extras: ["tabs"],
      extrasDir: "my-extras",
      purge: { content: ["*.html"], safelist: ["tabs-marker"] },
    }),
  );
  // --config from another folder
  const explicit = run(["build", "--config", join(cfg, "pico.config.json")], join(dir, "project"));
  assert.equal(explicit.status, 0, explicit.stderr);
  assert.doesNotMatch(explicit.stderr, /warning/);
  assert.match(explicit.stdout, /--pico-brand-marker: 1px/);
  assert.match(explicit.stdout, /\.tabs-marker/);
  // found in the working directory, as before
  const found = run(["build"], cfg);
  assert.equal(found.status, 0, found.stderr);
  assert.equal(found.stdout, explicit.stdout);
});

test("CLI flags stay relative to the working directory", () => {
  const cwd = join(dir, "flags");
  mkdirSync(join(cwd, "sub"), { recursive: true });
  writeFileSync(join(cwd, "own.css"), ":root { --pico-own-marker: 2px; }");
  writeFileSync(join(cwd, "sub", "pico.config.json"), JSON.stringify({ scope: ".x" }));
  const res = run(["build", "--config", "sub/pico.config.json", "--theme", "own.css"], cwd);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /--pico-own-marker: 2px/);
});
