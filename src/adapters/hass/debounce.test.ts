import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leadingDebounce, timerSchedule } from "./debounce";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("leadingDebounce, as the frontend's debounce(…, 500, true)", () => {
  it("runs at once on the first call, and not again when no other call came", () => {
    const run = vi.fn();
    const debounced = leadingDebounce(run, 500, timerSchedule);
    debounced.call();
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs once more at the end when calls came during the wait", () => {
    const run = vi.fn();
    const debounced = leadingDebounce(run, 500, timerSchedule);
    for (let i = 0; i < 5; i++) {
      debounced.call();
      vi.advanceTimersByTime(90);
    }
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("restarts the wait on every call", () => {
    const run = vi.fn();
    const debounced = leadingDebounce(run, 500, timerSchedule);
    debounced.call();
    vi.advanceTimersByTime(400);
    debounced.call();
    vi.advanceTimersByTime(400);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("runs on the leading edge again once the wait is over", () => {
    const run = vi.fn();
    const debounced = leadingDebounce(run, 500, timerSchedule);
    debounced.call();
    vi.advanceTimersByTime(500);
    debounced.call();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("cancel drops the pending trailing run", () => {
    const run = vi.fn();
    const debounced = leadingDebounce(run, 500, timerSchedule);
    debounced.call();
    debounced.call();
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
