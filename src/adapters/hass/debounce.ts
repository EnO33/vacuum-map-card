/** Runs `run` after `ms` milliseconds and returns the function that cancels it: an injectable timer. */
export type Schedule = (run: () => void, ms: number) => () => void;

/** The default `Schedule`, over `setTimeout` and `clearTimeout`. */
export const timerSchedule: Schedule = (run, ms) => {
  const handle = setTimeout(run, ms);
  return () => clearTimeout(handle);
};

export interface Debounced {
  call(): void;
  /** Drops the pending wait and its trailing run. */
  cancel(): void;
}

/**
 * The frontend's `debounce(func, wait, true)` (20261028.6, `src/common/util/debounce.ts`), as its registry collections
 * use it: the first call runs at once; every call restarts the wait; when calls came during the wait, `run` runs once
 * more when it ends.
 */
export function leadingDebounce(run: () => void, wait: number, schedule: Schedule): Debounced {
  let cancelWait: (() => void) | undefined;
  let trailing = false;
  return {
    call() {
      const leading = cancelWait === undefined;
      if (!leading) trailing = true;
      cancelWait?.();
      cancelWait = schedule(() => {
        cancelWait = undefined;
        if (!trailing) return;
        trailing = false;
        run();
      }, wait);
      if (leading) run();
    },
    cancel() {
      cancelWait?.();
      cancelWait = undefined;
      trailing = false;
    },
  };
}
