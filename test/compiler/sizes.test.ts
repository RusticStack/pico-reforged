import assert from "node:assert/strict";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { test } from "vite-plus/test";
import { compile, compileBoth } from "../../scripts/lib/compiler/index.ts";

test("compressed sizes are right, computed once and survive a spread", async () => {
  const { css, stats } = await compile({ entry: "colors", minify: true });
  const buf = Buffer.from(css);
  assert.equal(stats.bytes, buf.length);
  assert.equal(stats.gzipBytes, gzipSync(buf).length);
  assert.equal(stats.brotliBytes, brotliCompressSync(buf).length);

  // A lazy getter, readable as often as wanted
  const descriptor = Object.getOwnPropertyDescriptor(stats, "brotliBytes");
  assert.ok(descriptor?.get && descriptor.enumerable);
  const first = stats.brotliBytes;
  assert.equal(stats.brotliBytes, first);
  assert.equal(stats.gzipBytes, stats.gzipBytes);

  const copy = { ...stats };
  assert.equal(copy.gzipBytes, stats.gzipBytes);
  assert.equal(copy.brotliBytes, first);
  const json = JSON.parse(JSON.stringify(stats)) as typeof stats;
  assert.equal(json.gzipBytes, stats.gzipBytes);
  assert.equal(json.durationMs, stats.durationMs);
});

test("the two outputs of compileBoth have their own sizes", async () => {
  const { plain, min } = await compileBoth({ entry: "colors" });
  assert.equal(plain.stats.gzipBytes, gzipSync(Buffer.from(plain.css)).length);
  assert.equal(min.stats.gzipBytes, gzipSync(Buffer.from(min.css)).length);
  assert.ok(min.stats.bytes < plain.stats.bytes);
});
