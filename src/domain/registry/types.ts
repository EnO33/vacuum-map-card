// Home Assistant registry entries as the card uses them (ADR 0005). Names and aliases are kept and compared whole
// (ADR 0002 « Parsing limits » item 3, `../text/registry-name.ts`); the string cap applies to integration strings.

/** A floor of `config/floor_registry/list`. */
export interface Floor {
  readonly floorId: string;
  readonly name: string;
  readonly aliases: readonly string[];
}

/** An area of the area registry; `floorId` is `null` for an area on no floor. */
export interface Area {
  readonly areaId: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly floorId: string | null;
}
