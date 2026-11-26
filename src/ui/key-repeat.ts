/** A held Enter or Space repeating: never a new choice (ADR 0004 « Enter selects on key down, not when it repeats »). */
export function isRepeatedActivation(event: KeyboardEvent): boolean {
  return event.repeat && (event.key === "Enter" || event.key === " ");
}

/**
 * Drops every repeated Enter or Space on the page: the key that chose a robot, still held, must not go on to confirm
 * the start in a dialog that has just taken the focus. Listens on `window` in the capture phase, so it runs before any
 * dialog, Home Assistant's included. It ends by itself once that key is released (or the window loses the focus, which
 * ends every repeat), so it never outlives the key press; the returned function ends it sooner.
 */
export function holdKeyRepeats(): () => void {
  const drop = (event: KeyboardEvent): void => {
    if (!isRepeatedActivation(event)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onKeyup = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") release();
  };
  const release = (): void => {
    window.removeEventListener("keydown", drop, { capture: true });
    window.removeEventListener("keyup", onKeyup, { capture: true });
    window.removeEventListener("blur", release);
  };
  window.addEventListener("keydown", drop, { capture: true });
  window.addEventListener("keyup", onKeyup, { capture: true });
  window.addEventListener("blur", release);
  return release;
}
