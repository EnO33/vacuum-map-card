// Checks that the build wrote exactly one JavaScript file and prints its raw and gzip size.
// Node.js standard library only. Run after `vite build` (see the "build" script).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const outDir = "dist";
const { name } = JSON.parse(readFileSync("package.json", "utf8"));
const expected = `${name}.js`;
const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name));

if (files.length !== 1 || files[0] !== join(outDir, expected)) {
  console.error(`Expected only ${join(outDir, expected)} in ${outDir}/, found: ${files.join(", ") || "nothing"}`);
  process.exit(1);
}

const content = readFileSync(files[0]);
const gzip = gzipSync(content, { level: 9 });
console.log(`${files[0]}: ${content.length} B raw, ${gzip.length} B gzip`);
