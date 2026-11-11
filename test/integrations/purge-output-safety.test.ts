import assert from "node:assert/strict";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vite-plus/test";
import { findPicoBlocks, purgeOutput } from "../../scripts/lib/integrations/purge-output.ts";
import { makeProject } from "./helpers.ts";

const PICO = "@layer pico.core{.used{color:red}.unused{color:blue}}";
const PAGE = '<p class="used">x</p>';

/** Symlinks need a privilege on Windows that most accounts lack. */
const canLink = ((): boolean => {
  const dir = mkdtempSync(join(tmpdir(), "pico-link-"));
  try {
    writeFileSync(join(dir, "a"), "");
    symlinkSync(join(dir, "a"), join(dir, "b"), "file");
    return true;
  } catch {
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
})();

test.skipIf(!canLink)(
  "a linked CSS file that points outside the folder is not modified",
  async () => {
    const outside = makeProject({ "x.css": PICO });
    const dir = makeProject({ "index.html": PAGE, "own.css": PICO });
    symlinkSync(`${outside}/x.css`, `${dir}/link.css`, "file");
    const result = await purgeOutput({ dir });
    assert.equal(readFileSync(`${outside}/x.css`, "utf8"), PICO);
    assert.ok(!readFileSync(`${dir}/own.css`, "utf8").includes(".unused"));
    assert.ok(result.notes.some((n) => n.includes("link.css") && n.includes("outside")));
  },
);

test("a broken link does not stop the run", async () => {
  const dir = makeProject({ "index.html": PAGE, "own.css": PICO });
  if (canLink) symlinkSync(`${dir}/missing.css`, `${dir}/broken.css`, "file");
  await purgeOutput({ dir });
  assert.ok(!readFileSync(`${dir}/own.css`, "utf8").includes(".unused"));
});

test("a --css pattern that leaves the folder does not touch the file outside", async () => {
  const parent = makeProject({ "x.css": PICO, "site/index.html": PAGE, "site/own.css": PICO });
  const result = await purgeOutput({ dir: `${parent}/site`, css: ["../x.css", `${parent}/x.css`] });
  assert.equal(readFileSync(`${parent}/x.css`, "utf8"), PICO);
  assert.ok(
    result.notes.some((n) => n.includes("outside")),
    result.notes.join("\n"),
  );
  assert.equal(result.files.length, 0);
});

test("CSS under node_modules in the folder is left alone", async () => {
  const dir = makeProject({ "index.html": PAGE, "node_modules/kit/kit.css": PICO });
  const result = await purgeOutput({ dir });
  assert.equal(readFileSync(`${dir}/node_modules/kit/kit.css`, "utf8"), PICO);
  assert.ok(result.notes.some((n) => n.includes("node_modules")));
});

test("when one file cannot be purged, no file is written", async () => {
  const dir = makeProject({
    "index.html": PAGE,
    "a.css": PICO,
    "b.css": "@layer pico.core{.a:nth-child(foo){color:red}}",
  });
  const before = readFileSync(`${dir}/a.css`);
  await assert.rejects(purgeOutput({ dir }), /b\.css.*No file was changed/);
  assert.ok(readFileSync(`${dir}/a.css`).equals(before));
});

test("a leading BOM survives a rewrite and no temp file is left", async () => {
  const dir = makeProject({ "index.html": PAGE, "site.css": `﻿${PICO}` });
  await purgeOutput({ dir });
  const bytes = readFileSync(`${dir}/site.css`);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.ok(!bytes.toString("utf8").includes(".unused"));
  assert.deepEqual(readdirSync(dir).toSorted(), ["index.html", "site.css"]);
});

test("a file that is not valid UTF-8 is left alone with a note", async () => {
  const bytes = Buffer.concat([Buffer.from("/* \xff */", "latin1"), Buffer.from(PICO)]);
  const dir = makeProject({ "index.html": PAGE, "site.css": bytes });
  const result = await purgeOutput({ dir });
  assert.ok(readFileSync(`${dir}/site.css`).equals(bytes));
  assert.ok(result.notes.some((n) => n.includes("UTF-8")));
});

test("escaped quotes and braces in app selectors do not hide the pico layer", async () => {
  const app =
    String.raw`.content-\[\'x\'\]{content:'x'}.w-\[\{\]{color:red}.q-\"{color:red}` + "\n";
  const dir = makeProject({ "index.html": PAGE, "site.css": `${app}${PICO}` });
  assert.equal(findPicoBlocks(`${app}${PICO}`).length, 1);
  await purgeOutput({ dir });
  const out = readFileSync(`${dir}/site.css`, "utf8");
  assert.ok(out.startsWith(app), "app CSS is byte for byte the same");
  assert.ok(out.includes(".used") && !out.includes(".unused"), out);
});

const SPIN =
  "@layer pico.core{@keyframes spin{to{opacity:0}}.unused{animation:spin 1s}.used{color:red}}";

test("a keyframe another stylesheet or an inline style uses is kept", async () => {
  const alone = makeProject({ "index.html": PAGE, "pico.css": SPIN });
  await purgeOutput({ dir: alone });
  assert.ok(!readFileSync(`${alone}/pico.css`, "utf8").includes("@keyframes"), "dropped alone");

  const other = makeProject({
    "index.html": PAGE,
    "pico.css": SPIN,
    "app.css": ".loader{animation:spin 2s}",
  });
  await purgeOutput({ dir: other });
  const out = readFileSync(`${other}/pico.css`, "utf8");
  assert.ok(out.includes("@keyframes spin") && !out.includes(".unused"), out);

  const inline = makeProject({
    "index.html": `${PAGE}<div style="animation: spin 1s"></div>`,
    "pico.css": SPIN,
  });
  await purgeOutput({ dir: inline });
  assert.ok(readFileSync(`${inline}/pico.css`, "utf8").includes("@keyframes spin"));
});
