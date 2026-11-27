import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const THEME = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

/** The card's source files, tests left out. */
function sources(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => readFileSync(join(SRC, file), "utf8"));
}

/** Custom properties a text declares (`--name:`). */
function declared(text: string): Set<string> {
  return new Set(Array.from(text.matchAll(/(--[\w-]+)\s*:/g), ([, name]) => name ?? ""));
}

/** The text from `open` (just after a `(`) up to its matching `)`, and the index after that `)`. */
function group(text: string, open: number): { readonly inside: string; readonly next: number } {
  let depth = 1;
  let index = open;
  while (index < text.length && depth > 0) {
    if (text[index] === "(") depth += 1;
    if (text[index] === ")") depth -= 1;
    index += 1;
  }
  return { inside: text.slice(open, index - 1), next: index };
}

/**
 * The custom properties of one `var()` chain (`var(--a, var(--b))` gives `--a`, `--b`), or none when the chain ends
 * in a literal value, which shows whatever the page declares.
 */
function chainOf(inside: string): string[] {
  const [, name, fallback] = /^\s*(--[\w-]+)\s*(?:,([\s\S]*))?$/.exec(inside) ?? [];
  if (name === undefined) return [];
  if (fallback === undefined) return [name];
  const rest = fallback.trim();
  if (!rest.startsWith("var(")) return [];
  const tail = chainOf(group(rest, "var(".length).inside);
  return tail.length === 0 ? [] : [name, ...tail];
}

/** Every outermost `var()` chain of a text that ends with no literal value. */
function chainsWithoutValue(text: string): string[][] {
  const chains: string[][] = [];
  let from = text.indexOf("var(");
  while (from !== -1) {
    const { inside, next } = group(text, from + "var(".length);
    const chain = chainOf(inside);
    if (chain.length > 0) chains.push(chain);
    from = text.indexOf("var(", next);
  }
  return chains;
}

describe("demo theme", () => {
  it("declares a variable of every chain the card reads that ends with no value", () => {
    const texts = sources();
    const known = new Set([...texts.flatMap((text) => [...declared(text)]), ...declared(THEME)]);
    const unresolved = texts
      .flatMap(chainsWithoutValue)
      .filter((chain) => !chain.some((name) => known.has(name)))
      .map((chain) => chain.join(" > "));
    expect([...new Set(unresolved)]).toStrictEqual([]);
  });
});
