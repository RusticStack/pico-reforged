import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, test } from "vite-plus/test";
import { compile } from "../../scripts/lib/compiler/index.ts";
import { tokensReadByExtras } from "../../scripts/lib/compiler/module-tokens.ts";

const dir = mkdtempSync(join(tmpdir(), "pico-module-tokens-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("tokens the prebuilt extras read stay when their module is left out", async () => {
  const reads = tokensReadByExtras();
  assert.ok(reads.has("--pico-card-border-radius"));
  assert.ok(reads.has("--pico-dropdown-background-color"));
  assert.ok(reads.has("--pico-modal-overlay-background-color"));
  assert.ok(!reads.has("--pico-range-thumb-color"));

  const { css } = await compile({
    exclude: ["components/card", "components/dropdown", "components/modal", "forms/input-range"],
  });
  assert.match(css, /--pico-card-border-radius:/);
  assert.match(css, /--pico-card-sectioning-background-color:/);
  assert.match(css, /--pico-dropdown-background-color:/);
  assert.match(css, /--pico-modal-overlay-background-color:/);
  // No extra reads these, so they still go.
  assert.doesNotMatch(css, /--pico-icon-close:/);
  assert.doesNotMatch(css, /--pico-range-thumb-color:/);
});

test("the orphan token pass runs until a long alias chain is gone", async () => {
  const chain = Array.from(
    { length: 8 },
    (_, i) => `--pico-card-chain-${i}: var(--pico-card-chain-${i + 1});`,
  ).join(" ");
  const theme = join(dir, "chain.css");
  writeFileSync(theme, `:root { ${chain} --pico-card-chain-8: 1px; }`);
  const { css } = await compile({ theme, exclude: ["components/card"] });
  assert.doesNotMatch(css, /--pico-card-chain-/);
});
