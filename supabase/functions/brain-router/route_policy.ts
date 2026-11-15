/** Keep the queued and internal Brain paths on the unified ai-router catalog.
 * The legacy Brain model/tier catalog is read only by the compatibility
 * synchronous path while older clients are being retired.
 */
export function shouldLoadLegacyBrainTiers(mode: unknown, internalWorker: boolean): boolean {
  if (internalWorker) return false;
  return !(typeof mode === "string" && mode.trim().toLowerCase() === "enqueue");
}
