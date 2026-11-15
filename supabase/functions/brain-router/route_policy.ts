/** Keep queued and internal Brain paths on the unified ai-router catalog.
 * The legacy Brain model/tier catalog is read only by the backward-compatible
 * synchronous path while older clients are being retired.
 */
export function shouldLoadLegacyBrainTiers(_mode: unknown, _internalWorker: boolean): boolean {
  return false;
}
