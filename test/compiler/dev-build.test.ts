import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vite-plus/test";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), "pico-dev-build-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const run = (args: string[]) =>
  spawnSync(process.execPath, ["scripts/dev-build.ts", ...args], { cwd: root, encoding: "utf8" });

test("dev-build takes an absolute --out folder", () => {
  const out = join(dir, "abs");
  const res = run(["--out", out, "--targets", "modern"]);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(readdirSync(out).length, 6);
});

test("dev-build fails on a flag without a value", () => {
  for (const args of [["--out"], ["--targets"], ["--out", "--minify"]]) {
    const res = run(args);
    assert.equal(res.status, 2, args.join(" "));
    assert.match(res.stderr, /needs a value/);
  }
});
