// PostToolUse(Edit|Write|MultiEdit): runs the project's own Biome formatter on the file just
// written, so no turn is spent on formatting. Format only: lint stays in `pnpm run lint`.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { readPayload } from "./lib.mjs";

const payload = readPayload();
const file = String(payload?.tool_input?.file_path ?? "");
const formattable = /\.(ts|mts|cts|js|mjs|cjs|json|jsonc|css)$/i;
if (file === "" || !formattable.test(file) || !existsSync(file)) process.exit(0);

/** Nearest ancestor holding a local Biome binary, or undefined (before the bootstrap: none). */
function findBiome(start) {
  let dir = path.dirname(path.resolve(start));
  for (;;) {
    for (const bin of ["biome.cmd", "biome"]) {
      const candidate = path.join(dir, "node_modules", ".bin", bin);
      if (existsSync(candidate)) return { bin: candidate, cwd: dir };
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

const biome = findBiome(file);
if (biome === undefined) process.exit(0);

const result = spawnSync(biome.bin, ["format", "--write", file], {
  cwd: biome.cwd,
  encoding: "utf8",
  shell: process.platform === "win32",
  timeout: 20_000,
});
if (result.status !== 0) {
  process.stderr.write(`[vacuum-map-card format] biome could not format ${file}:\n${result.stderr || result.stdout}\n`);
  process.exit(2);
}
process.exit(0);
