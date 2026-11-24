// Checks that the build wrote exactly the card file and its source map, that it bundles only `src/` and dependencies,
// and prints the card's raw and gzip size.
// In GitHub Actions, the size also goes to the job summary.
// Node.js standard library only. Run after `vite build` (see the "build" script).
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const outDir = "dist";
const { name } = JSON.parse(readFileSync("package.json", "utf8"));
const card = join(outDir, `${name}.js`);
const expected = [card, `${card}.map`];
const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name))
  .sort();

if (files.join("\n") !== expected.join("\n")) {
  console.error(`Expected only ${expected.join(" and ")} in ${outDir}/, found: ${files.join(", ") || "nothing"}`);
  process.exit(1);
}

// Only the card's own code and its dependencies are bundled: nothing from the demo page (`demo/`) or the tests.
const { sources } = JSON.parse(readFileSync(`${card}.map`, "utf8"));
const foreign = sources.filter((source) => !/^\.\.\/(src|node_modules)\//.test(source));
if (sources.length === 0 || foreign.length > 0) {
  console.error(`Only src/ and node_modules/ may be bundled, found: ${foreign.join(", ") || "no source at all"}`);
  process.exit(1);
}

const content = readFileSync(card);
const gzip = gzipSync(content, { level: 9 });
console.log(`${card}: ${content.length} B raw, ${gzip.length} B gzip`);

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) {
  appendFileSync(
    summary,
    `### Bundle size\n\n| File | Raw | Gzip |\n|---|---|---|\n| \`${name}.js\` | ${content.length} B | ${gzip.length} B |\n`,
  );
}
