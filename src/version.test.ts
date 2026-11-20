import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };
import { CARD_VERSION } from "./version";

describe("CARD_VERSION", () => {
  it("is the version declared in package.json", () => {
    expect(CARD_VERSION).toBe(packageJson.version);
  });
});
