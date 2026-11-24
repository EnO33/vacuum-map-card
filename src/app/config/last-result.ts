/**
 * `fn` remembering its last call: the same arguments, compared by reference, give the same result object, so a
 * filter applied on every `hass` update keeps its output stable and costs no render.
 */
export function lastResult<A, B, R>(fn: (a: A, b: B) => R): (a: A, b: B) => R {
  let last: { readonly a: A; readonly b: B; readonly result: R } | undefined;
  return (a, b) => {
    if (last === undefined || last.a !== a || last.b !== b) last = { a, b, result: fn(a, b) };
    return last.result;
  };
}
