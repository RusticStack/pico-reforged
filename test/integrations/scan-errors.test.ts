import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { Scanner } from "../../scripts/lib/integrations/scanner.ts";
import { Engine } from "../../scripts/lib/integrations/process.ts";
import { purgeOutput } from "../../scripts/lib/integrations/purge-output.ts";
import { makeProject } from "./helpers.ts";

// Locked files and folders without permission cannot be made the same way on every platform,
// so fs fails on purpose for paths with these names.
const reads = vi.hoisted(() => new Map<string, number>());

vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  const fail = (code: string): Error => Object.assign(new Error(`${code}: test`), { code });
  const readdirSync = ((path: string, ...rest: unknown[]) => {
    if (path.includes("locked-folder")) throw fail("EACCES");
    return (fs.readdirSync as (...args: unknown[]) => unknown)(path, ...rest);
  }) as typeof fs.readdirSync;
  const statSync = ((path: string, ...rest: unknown[]) => {
    if (path.includes("vanished")) throw fail("ENOENT");
    return (fs.statSync as (...args: unknown[]) => unknown)(path, ...rest);
  }) as typeof fs.statSync;
  const readFileSync = ((name: string, ...rest: unknown[]) => {
    const count = (reads.get(name) ?? 0) + 1;
    reads.set(name, count);
    if (name.includes("denied")) throw fail("EACCES");
    if (name.includes("busy-always")) throw fail("EBUSY");
    if (name.includes("busy-once") && count === 1) throw fail("EBUSY");
    return (fs.readFileSync as (...args: unknown[]) => unknown)(name, ...rest);
  }) as typeof fs.readFileSync;
  return {
    ...fs,
    default: { ...fs, readdirSync, statSync, readFileSync },
    readdirSync,
    statSync,
    readFileSync,
  };
});

const files = {
  "package.json": "{}",
  "index.html": '<p class="used">x</p>',
  "locked-folder/page.html": '<p class="in-locked-folder">x</p>',
  "denied.html": '<p class="in-denied">x</p>',
  "busy-once.html": '<p class="in-busy-once">x</p>',
  "busy-always.html": '<p class="in-busy-always">x</p>',
  "vanished.html": '<p class="in-vanished">x</p>',
};

test("files and folders that cannot be read are reported, a vanished file is not", () => {
  const dir = makeProject(files);
  const { index, errors } = new Scanner({ root: dir }).scan();
  assert.ok(index.classes.has("used"));
  assert.ok(index.classes.has("in-busy-once"), "a busy file is read again once");
  for (const name of ["in-locked-folder", "in-denied", "in-busy-always", "in-vanished"]) {
    assert.ok(!index.classes.has(name), name);
  }
  const found = errors.map((e) => `${e.path.slice(dir.length + 1)} ${e.code}`).toSorted();
  assert.deepEqual(found, ["busy-always.html EBUSY", "denied.html EACCES", "locked-folder EACCES"]);
  assert.equal(reads.get(`${dir}/busy-always.html`), 2, "retried once");
});

test("the Engine warns about files it could not read", async () => {
  const dir = makeProject(files);
  const result = await new Engine().process({
    css: '@import "@rusticstack/pico-reforged";\n',
    file: `${dir}/app.css`,
    purge: true,
    projectRoot: dir,
  });
  assert.ok(result);
  const warning = result.warnings.find((w) => w.includes("could not be read"));
  assert.ok(warning, result.warnings.join("\n"));
  assert.match(warning, /^3 file\(s\) or folder\(s\)/);
  assert.match(warning, /denied\.html \(EACCES\)/);
});

test("the purge command notes files it could not read", async () => {
  const dir = makeProject({
    ...files,
    "site.css": "@layer pico.core{.used{color:red}.unused{color:blue}}",
  });
  const result = await purgeOutput({ dir });
  assert.ok(
    result.notes.some((n) => n.includes("could not be read") && n.includes("locked-folder")),
    result.notes.join("\n"),
  );
});
