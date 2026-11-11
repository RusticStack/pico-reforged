import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, test } from "vite-plus/test";
import { compile } from "../../scripts/lib/compiler/index.ts";
import { emptyIndex, purgeSelectors } from "../../scripts/lib/compiler/purge.ts";
import { headers, mapSelectors } from "./helpers.ts";

const dir = mkdtempSync(join(tmpdir(), "pico-safelist-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const page = join(dir, "page.html");
writeFileSync(page, "<main><p>Hi</p></main>");

// A safelisted id keeps a selector even when its other parts (aside, here) are not in the
// content. With a shared global or sticky regex, the match on one rule moved lastIndex and the
// next rule was tested from there, so it was dropped.
const rules = ["#x-one aside", "#x-two aside", "#x-three aside"];

for (const order of [rules, rules.toReversed()]) {
  test(`global and sticky safelist regexes keep every match (${order[0]} first)`, async () => {
    const theme = join(dir, `theme-${order.length}-${order[0]?.slice(1, 6)}.css`);
    writeFileSync(theme, order.map((sel, i) => `${sel} { z-index: ${i}; }`).join("\n"));
    for (const regex of [/^#x-/g, /^#x-/y, /#x-/gy]) {
      const { css } = await compile({ theme, purge: { content: [page], safelist: [regex] } });
      const h = headers(css);
      for (const sel of order) assert.ok(h.includes(sel), `${regex} dropped ${sel}`);
    }
  });
}

test("a global regex set straight on an index (the purge command) is stateless too", () => {
  const index = emptyIndex();
  index.safelist = [/^#x-/g];
  const css = rules.map((sel, i) => `${sel}{z-index:${i}}`).join("");
  const out = mapSelectors(css, (sel) => purgeSelectors(index, [sel]));
  assert.deepEqual(headers(out), rules);
});
