// Sizes of the minified pico, classless and extras builds, compiled in memory the way the matrix
// writes css/*.min.css (default targets, one-line banner). Used by size.test.ts and update.ts.
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { compile } from "../../scripts/lib/compiler/index.ts";
import type { CompileOptions } from "../../scripts/lib/compiler/index.ts";
import { banner } from "../../scripts/lib/compiler/matrix.ts";

export type Size = { raw: number; gzip: number; brotli: number };

export const ENTRIES: Record<string, CompileOptions> = {
  pico: {},
  classless: { entry: "classless" },
  extras: { entry: "extras", extras: true },
};

export const BASELINE = new URL("baseline.json", import.meta.url);

export async function measure(): Promise<Record<string, Size>> {
  const out: Record<string, Size> = {};
  for (const [name, options] of Object.entries(ENTRIES)) {
    const { css } = await compile({ ...options, minify: true, banner: banner(true) });
    const buf = Buffer.from(css);
    out[name] = {
      raw: buf.length,
      gzip: gzipSync(buf, { level: 9 }).length,
      brotli: brotliCompressSync(buf, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
      }).length,
    };
  }
  return out;
}
