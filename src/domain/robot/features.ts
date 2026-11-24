/** `VacuumEntityFeature.CLEAN_AREA` (bit 14), core 2026.11.2 (`docs/research/ha-core-vacuum.md`). */
const CLEAN_AREA_FEATURE = 16384;

/** Whether a vacuum's `supported_features` include area cleaning (ADR 0003 « Path 1 »). */
export function supportsCleanArea(supportedFeatures: number): boolean {
  return (supportedFeatures & CLEAN_AREA_FEATURE) !== 0;
}
