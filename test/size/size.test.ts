import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vite-plus/test";
import { BASELINE, ENTRIES, measure } from "./measure.ts";
import type { Size } from "./measure.ts";

// Gzip may grow this much over the baseline before the test fails.
const BUDGET = 0.02;

test("the minified builds stay within 2% gzip of the size baseline", async () => {
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, Size>;
  assert.deepEqual(Object.keys(baseline), Object.keys(ENTRIES));
  const now = await measure();
  for (const [name, size] of Object.entries(now)) {
    const before = baseline[name] as Size;
    const limit = Math.floor(before.gzip * (1 + BUDGET));
    assert.ok(
      size.gzip <= limit,
      `${name}.min.css is ${size.gzip} bytes gzipped, baseline ${before.gzip}, limit ${limit}. ` +
        "If the growth is intended, run pnpm test:size:update and commit test/size/baseline.json.",
    );
  }
});
