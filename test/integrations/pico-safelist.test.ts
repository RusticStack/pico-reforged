import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { parseRoot } from "../../scripts/lib/integrations/detect.ts";
import { applyPicoBlock, emptyConfig, tokens } from "../../scripts/lib/integrations/pico-config.ts";

const safelist = (value: string): (string | RegExp)[] => {
  const root = parseRoot(`@import "@rusticstack/pico-reforged";\n@pico { safelist: ${value}; }`);
  assert.ok(root);
  return root.config.safelist;
};

test("a regex with a {n,m} quantifier stays one entry", () => {
  const [entry, ...rest] = safelist(String.raw`/^col-\d{1,2}$/`);
  assert.deepEqual(rest, []);
  assert.ok(entry instanceof RegExp);
  assert.equal(entry.source, String.raw`^col-\d{1,2}$`);
  assert.ok(entry.test("col-12") && !entry.test("col-123"));
});

test("a regex with a space and a comma in a class stays one entry", () => {
  const [entry, ...rest] = safelist("/^a[ ,]b$/i");
  assert.deepEqual(rest, []);
  assert.ok(entry instanceof RegExp);
  assert.equal(entry.flags, "i");
  assert.ok(entry.test("A b") && entry.test("a,B"));
});

test("an escaped slash and a slash in a class do not end the regex", () => {
  const [a, b] = safelist(String.raw`/^x\/y z$/ /^[/]p$/`);
  assert.ok(a instanceof RegExp && b instanceof RegExp);
  assert.ok(a.test("x/y z"));
  assert.ok(b.test("/p"));
});

test("a regex followed by plain names", () => {
  assert.deepEqual(safelist(String.raw`/^htmx-\w+$/g, modal-is-open "aria-busy"`).map(String), [
    String.raw`/^htmx-\w+$/g`,
    "modal-is-open",
    "aria-busy",
  ]);
});

test("an invalid regex names the pattern", () => {
  const config = emptyConfig();
  assert.throws(() => applyPicoBlock(config, "safelist: /a(/"), /invalid safelist pattern \/a\(\//);
});

test("other values split as before", () => {
  assert.deepEqual(tokens("tabs badge, alert"), ["tabs", "badge", "alert"]);
  assert.deepEqual(tokens("components/modal, forms/input-range"), [
    "components/modal",
    "forms/input-range",
  ]);
  assert.deepEqual(tokens(`"./brand theme.css" oklch(0.6 0.1 20)`), [
    `"./brand theme.css"`,
    "oklch(0.6 0.1 20)",
  ]);
  // A leading slash without a regex form is split as before.
  assert.deepEqual(tokens("/a b"), ["/a", "b"]);
  assert.deepEqual(tokens("/a/b-c d"), ["/a/b-c", "d"]);
  assert.deepEqual(tokens("/abs/path"), ["/abs/path"]);
});
