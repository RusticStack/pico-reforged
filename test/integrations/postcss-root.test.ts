import assert from "node:assert/strict";
import { isAbsolute, relative } from "node:path";
import postcss from "postcss";
import { test } from "vite-plus/test";
import pico from "../../scripts/integrations/postcss.ts";
import { makeProject } from "./helpers.ts";

test("a relative base still keeps the project folder out of the dir dependencies", async () => {
  const project = makeProject({
    "package.json": "{}",
    "index.html": '<main><button class="secondary">x</button></main>',
    "src/page.html": "<p>x</p>",
  });
  // "./site/" style input: relative, a trailing separator, a lower-case drive letter
  let base = `${relative(process.cwd(), project)}/`;
  if (isAbsolute(base) && /^[A-Z]:/.test(base)) base = base[0]?.toLowerCase() + base.slice(1);
  const result = await postcss([pico({ base, purge: true })]).process(
    '@import "@rusticstack/pico-reforged";\n',
    { from: `${project}/app.css` },
  );
  const fold = (path: string): string => (process.platform === "win32" ? path.toLowerCase() : path);
  const dirs = result.messages
    .filter((m) => m.type === "dir-dependency")
    .map((m) => (m["dir"] as string).replaceAll("\\", "/"));
  assert.ok(
    dirs.some((d) => d.endsWith("/src")),
    dirs.join("\n"),
  );
  for (const dir of dirs) assert.notEqual(fold(dir), fold(project), "project folder is skipped");
});
