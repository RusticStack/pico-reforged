// Usage: node test/size/update.ts
// Writes the current sizes into test/size/baseline.json. Run it after a reviewed size change.
import { writeFileSync } from "node:fs";
import { BASELINE, measure } from "./measure.ts";

const sizes = await measure();
writeFileSync(BASELINE, `${JSON.stringify(sizes, null, 2)}\n`);
for (const [name, s] of Object.entries(sizes)) {
  console.log(`${name}: ${s.raw} raw, ${s.gzip} gzip, ${s.brotli} brotli`);
}
