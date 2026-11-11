import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { snippet } from "../../scripts/lib/ai/html.ts";

test("snippet cuts an element and skips comments inside it", () => {
  const html = "<main>\n  <div><!-- <div> -->\n    <p>a</p>\n  </div>\n</main>";
  assert.equal(snippet(html, { find: "<div>" }), "<div><!-- <div> -->\n  <p>a</p>\n</div>");
});

test("an unclosed comment is an error, not an endless loop", () => {
  const html = "<main>\n  <div>\n    <!-- never closed\n    <p>a</p>\n</main>";
  assert.throws(() => snippet(html, { find: "<div>" }), /Unclosed comment inside <div>/);
});
