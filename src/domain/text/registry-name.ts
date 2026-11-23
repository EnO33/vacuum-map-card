import { caseFold } from "./case-fold";

/**
 * The key Home Assistant compares floor and area names by: `name.casefold().replace(" ", "")`
 * (normalized_name_base_registry.py, core 2026.11.2). Only U+0020 is removed, despite its « whitespace » docstring.
 */
export function registryNameKey(name: string): string {
  return caseFold(name).replaceAll(" ", "");
}
