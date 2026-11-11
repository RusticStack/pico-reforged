import { brotliCompressSync, gzipSync } from "node:zlib";
import type { CompileStats } from "./types.ts";

type Sizes = { bytes: number; gzipBytes: number; brotliBytes: number };

/**
 * Adds bytes, gzipBytes and brotliBytes to `target`. The compressed sizes are computed on first
 * read and then kept: brotli at quality 11 is slow and most callers never look at them. They are
 * enumerable getters, so a spread or JSON.stringify still carries the numbers.
 */
export function withSizes<T extends object>(target: T, css: string): T & Sizes {
  const buf = Buffer.from(css);
  const lazy = (compress: (b: Buffer) => Buffer): PropertyDescriptor => {
    let value: number | undefined;
    return {
      enumerable: true,
      configurable: true,
      get: () => (value ??= compress(buf).length),
    };
  };
  return Object.defineProperties(target, {
    bytes: { value: buf.length, enumerable: true, writable: true, configurable: true },
    gzipBytes: lazy((b) => gzipSync(b)),
    brotliBytes: lazy((b) => brotliCompressSync(b)),
  }) as T & Sizes;
}

const kb = (n: number): string => `${(n / 1024).toFixed(1)} kB`;

/** One line per build, for the CLI. */
export function formatStats(label: string, stats: CompileStats): string {
  const parts = [
    `${label}: ${kb(stats.bytes)}`,
    `gzip ${kb(stats.gzipBytes)}`,
    `brotli ${kb(stats.brotliBytes)}`,
    `${stats.rules} rules`,
  ];
  if (stats.removedByClassless) parts.push(`${stats.removedByClassless} dropped by classless`);
  if (stats.removedByPurge) parts.push(`${stats.removedByPurge} dropped by purge`);
  if (stats.extras.length) parts.push(`extras ${stats.extras.join(", ")}`);
  if (stats.excludedModules.length) parts.push(`excluded ${stats.excludedModules.join(", ")}`);
  parts.push(`${stats.durationMs} ms`);
  return parts.join(", ");
}

/** Table for the matrix command. */
export function formatTable(rows: { name: string; stats: CompileStats }[]): string {
  const width = Math.max(...rows.map((r) => r.name.length));
  return rows
    .map(
      (r) =>
        `${r.name.padEnd(width)}  ${kb(r.stats.bytes).padStart(10)}  ${kb(r.stats.gzipBytes).padStart(10)}`,
    )
    .join("\n");
}
