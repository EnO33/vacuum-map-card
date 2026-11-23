import { type Unsupported, unsupported } from "../unsupported";
import { withinTextCap } from "./limits";

/** A string from an integration within the cap (ADR 0002 « Parsing limits » item 3), or `too_long`; never cut. */
export function boundedText(s: string): string | Unsupported<"too_long"> {
  return withinTextCap(s) ? s : unsupported("too_long");
}
