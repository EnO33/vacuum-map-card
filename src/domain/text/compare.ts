/** Orders strings by UTF-16 code units, so an order never depends on the locale. */
export function compareCodeUnits(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
