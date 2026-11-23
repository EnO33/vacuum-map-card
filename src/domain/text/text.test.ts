import { describe, expect, it } from "vitest";
import vectors from "../../../test/fixtures/synthetic/casefold-vectors.json" with { type: "json" };
import { unsupported } from "../unsupported";
import { boundedText } from "./bounded-text";
import { caseFold } from "./case-fold";
import * as table from "./case-fold-table";
import { safeIcon } from "./icon";
import { registryNameKey } from "./registry-name";
import { isPlainRegionId, mayShadow } from "./shadow-key";

describe("caseFold", () => {
  it(`matches Python ${vectors.python} str.casefold() on every code point it changes`, () => {
    const wrong = vectors.vectors.filter(([cp, out]) => caseFold(String.fromCodePoint(Number(cp))) !== out);
    expect(wrong).toEqual([]);
    expect(vectors.vectors.length).toBeGreaterThan(1500);
  });

  it("keeps every other code point as it is, whatever toLowerCase would do (Cherokee, Unicode 17)", () => {
    const changed = new Set(vectors.vectors.map(([cp]) => Number(cp)));
    const moved: number[] = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if ((cp >= 0xd800 && cp <= 0xdfff) || changed.has(cp)) continue;
      const ch = String.fromCodePoint(cp);
      if (caseFold(ch) !== ch) moved.push(cp);
    }
    expect(moved).toEqual([]);
    expect(caseFold("Ꭰ")).toBe("Ꭰ");
  });

  it("folds per code point, with no final-sigma context", () => {
    expect(caseFold("ΣΑΣ")).toBe("σασ");
  });

  it("folds dotted capital I to i plus a combining dot, as Python does", () => {
    expect(caseFold("İ")).toBe("i̇");
  });

  it("reads a generated table made only of hexadecimal ranges", () => {
    expect(Object.keys(table).sort()).toEqual(["MULTI", "SINGLE_RANGES"]);
    expect(table.SINGLE_RANGES).toMatch(/^[0-9a-f,;-]+$/);
    expect(table.MULTI).toMatch(/^[0-9a-f,;:]+$/);
  });
});

describe("registryNameKey", () => {
  it.each(["Ground floor", "groundFLOOR", "Ground  floor", "Ground floor "])(
    "gives %j the key of « Ground floor »",
    (name) => {
      expect(registryNameKey(name)).toBe(registryNameKey("Ground floor"));
    },
  );

  it("removes only plain spaces, not tabs", () => {
    expect(registryNameKey("Ground\tfloor")).not.toBe(registryNameKey("Ground floor"));
  });

  it("matches the trailing-space name of the core fixtures", () => {
    expect(registryNameKey("Reading table ")).toBe(registryNameKey("Reading table"));
  });
});

describe("mayShadow", () => {
  it.each([
    ["Küche", "kuche"],
    [" 3 ", "3"],
    ["Zid 0", "zid_0"],
    ["ＺＩＤ_0", "0"],
    ["ＺＩＤ_0", "zid_0"],
    ["ß", "ss"],
    ["ﬁ", "fi"],
    ["!!", "room"],
    // Only the NFD key catches this one: Roomba+'s slug of « Café² » is « cafe ».
    ["Café²", "cafe"],
    // Roomba+ also slugs the requested id: « _ » and « __ » become « room », « zid__0 » becomes « zid_0 ».
    ["Room", "_"],
    ["!!", "__"],
    ["Zid 0", "zid__0"],
    ["K1", "k1"],
    // Capital sharp s: only the casefold key (from the generated table) catches it.
    ["ẞ1", "ss1"],
  ])("treats name %j as able to shadow id %j", (name, id) => {
    expect(mayShadow(name, id)).toBe(true);
  });

  it("does not see a shadow between unrelated text", () => {
    expect(mayShadow("Library", "1")).toBe(false);
  });
});

describe("isPlainRegionId", () => {
  it.each(["1", "zid_0", "A_b9", "x".repeat(255)])("accepts %j", (id) => {
    expect(isPlainRegionId(id)).toBe(true);
  });

  it.each(["", "x".repeat(256), "1/2", "zid-0", "é", " 3", "3\n"])("refuses %j", (id) => {
    expect(isPlainRegionId(id)).toBe(false);
  });
});

describe("boundedText", () => {
  it("keeps a string of 255 code units", () => {
    expect(boundedText("x".repeat(255))).toBe("x".repeat(255));
  });

  it("refuses a string over 255 code units and never cuts it", () => {
    expect(boundedText("x".repeat(256))).toEqual(unsupported("too_long"));
  });

  it("counts a surrogate pair as two code units at the boundary", () => {
    expect(boundedText(`${"x".repeat(253)}\u{1F600}`)).toBe(`${"x".repeat(253)}\u{1F600}`);
    expect(boundedText(`${"x".repeat(254)}\u{1F600}`)).toEqual(unsupported("too_long"));
  });
});

describe("safeIcon", () => {
  it("keeps a plain Material Design icon name", () => {
    expect(safeIcon("mdi:sofa")).toBe("mdi:sofa");
  });

  it.each(["mdi:Sofa", "mdi:sofa;x", "javascript:alert(1)", "", "mdi:x\n", `mdi:${"a".repeat(252)}`])(
    "refuses %j",
    (icon) => {
      expect(safeIcon(icon)).toBeUndefined();
    },
  );
});
