import { caseFold } from "./case-fold";

/**
 * The key Home Assistant compares floor and area names by: `name.casefold().replace(" ", "")`
 * (normalized_name_base_registry.py, core 2026.11.2). Only U+0020 is removed, despite its « whitespace » docstring.
 */
export function registryNameKey(name: string): string {
  return caseFold(name).replaceAll(" ", "");
}

/** Whether a registry entry's name or one of its aliases has the given `registryNameKey`. */
export function matchesRegistryName(
  key: string,
  entry: { readonly name: string; readonly aliases: readonly string[] },
): boolean {
  return registryNameKey(entry.name) === key || entry.aliases.some((alias) => registryNameKey(alias) === key);
}
