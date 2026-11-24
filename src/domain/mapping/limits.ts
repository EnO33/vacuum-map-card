// Collection caps from ADR 0002, amendment, « Parsing limits », item 3. Generous against real homes; over a cap the
// whole structure is unsupported, never truncated. The string cap is in `../text/limits.ts`.

/** Most keys (area ids) in `area_mapping`. */
export const MAX_AREA_MAPPING_KEYS = 500;

/** Most segment ids under one `area_mapping` key. */
export const MAX_SEGMENTS_PER_AREA = 100;

/** Most segment ids across all `area_mapping` keys, counted as stored. */
export const MAX_MAPPED_SEGMENTS = 2000;

/** Most entries in `last_seen_segments`. */
export const MAX_LAST_SEEN_SEGMENTS = 2000;
