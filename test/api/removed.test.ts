import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vite-plus/test";

const read = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("every removal allowed in test/api/removed.json is listed in docs/migration.md", () => {
  const removed = JSON.parse(read("test/api/removed.json")) as Record<
    string,
    Record<string, string[]>
  >;
  const migration = read("docs/migration.md");
  for (const [file, kinds] of Object.entries(removed)) {
    for (const [kind, names] of Object.entries(kinds)) {
      for (const name of names) {
        assert.ok(
          migration.includes(`\`${name}\``),
          `${name} (${kind}, ${file}) is allowed as removed but docs/migration.md does not list it`,
        );
      }
    }
  }
});
