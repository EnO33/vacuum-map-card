/** Change listeners: each called once per `notify`, never after its removal or `clear`, even during a pass. */
export class Listeners {
  readonly #listeners = new Set<() => void>();

  /** Adds `listener` and returns the function that removes it. */
  add(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Calls every listener; a listener that throws does not stop the others, and nothing is logged. */
  notify(): void {
    for (const listener of [...this.#listeners]) {
      // A listener may remove another one, or clear them all by stopping its source.
      if (!this.#listeners.has(listener)) continue;
      try {
        listener();
      } catch {
        // A failing listener must not stop the others.
      }
    }
  }

  clear(): void {
    this.#listeners.clear();
  }
}
