// Quick build for development and tests: the azure variants in readable form, written to
// dist-dev/ (or --out <folder>), or minified with --minify. The full file set comes from
// `npm run build`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./lib/compiler/index.ts";
import type { CompileOptions } from "./lib/compiler/index.ts";

const root = fileURLToPath(new URL("../", import.meta.url));

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  if (at === -1) return undefined;
  const value = process.argv[at + 1];
  if (!value || value.startsWith("--")) {
    console.error(`${name} needs a value`);
    process.exit(2);
  }
  return value;
}

// A relative --out is taken from the repository root, an absolute one as it is.
const outName = flag("--out") ?? "dist-dev";
const outDir = resolve(root, outName);
mkdirSync(outDir, { recursive: true });

// --targets <query|modern> builds for another floor, to run the visual tests against it.
const targetsValue = flag("--targets");
const targets = targetsValue ? { targets: targetsValue } : {};
// --minify runs the minify pass too (selector factoring only happens there).
const minify = process.argv.includes("--minify");

const files: Record<string, CompileOptions> = {
  "pico.css": {},
  "pico.classless.css": { entry: "classless" },
  "pico.conditional.css": { scope: ".pico" },
  "pico.fluid.classless.css": { entry: "classless", fluid: true },
  "pico.colors.css": { entry: "colors" },
  "pico.extras.css": { entry: "extras" },
};

for (const [name, options] of Object.entries(files)) {
  const { css } = await compile({ ...options, ...targets, minify });
  writeFileSync(join(outDir, name), css);
  console.log(`${outName}/${name}: ${css.length} bytes`);
}
