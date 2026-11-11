import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { compile } from "../../scripts/lib/compiler/index.ts";
import { buildTheme } from "../../scripts/lib/themes.ts";

test("hue and chroma must be finite, chroma from 0 to 0.5", async () => {
  assert.throws(() => buildTheme({ hue: Number.NaN, chroma: 0.1 }), /hue .*NaN/);
  assert.throws(() => buildTheme({ hue: 200, chroma: Number.NaN }), /chroma .*NaN/);
  assert.throws(() => buildTheme({ hue: 200, chroma: Infinity }), /chroma .*Infinity/);
  assert.throws(() => buildTheme({ hue: Infinity, chroma: 0.1 }), /hue .*Infinity/);
  assert.throws(() => buildTheme({ hue: 200, chroma: -0.1 }), /chroma .*-0\.1/);
  assert.throws(() => buildTheme({ hue: 200, chroma: 19 }), /chroma .*19/);
  await assert.rejects(compile({ theme: { hue: 200, chroma: Infinity } }), /chroma/);
});

test("hue wraps into 0 to 360", () => {
  const a = buildTheme({ hue: 725, chroma: 0.15 });
  const b = buildTheme({ hue: 5, chroma: 0.15 });
  assert.equal(a.hue, 5);
  assert.equal(a.css, b.css);
  assert.equal(buildTheme({ hue: -10, chroma: 0.15 }).hue, 350);
});

test("a grey color, which has no hue, still builds", () => {
  for (const color of ["#808080", "oklch(0.6 0 0)", "rgb(10 10 10)"]) {
    const theme = buildTheme(color);
    assert.equal(theme.hue, 0);
    assert.equal(theme.chroma, 0);
    assert.match(theme.css, /--pico-primary:/);
  }
});
