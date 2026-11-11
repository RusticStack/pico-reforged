import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { test } from "vite-plus/test";
import { generate } from "../../scripts/generate.ts";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const read = (path: string): string =>
  readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n");

test("the generated sources in src/ are up to date", () => {
  const files = generate();
  assert.ok(Object.keys(files).length > 20);
  for (const [path, content] of Object.entries(files)) {
    assert.equal(read(path), content, `${path} is stale, run: node scripts/generate.ts`);
  }
  for (const dir of ["src/themes", "src/colors"]) {
    for (const file of readdirSync(join(root, dir))) {
      assert.ok(`${dir}/${file}` in files, `${dir}/${file} is not written by scripts/generate.ts`);
    }
  }
});
