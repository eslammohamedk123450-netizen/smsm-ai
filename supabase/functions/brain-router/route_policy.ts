/** Legacy Brain catalog loading is permanently disabled; all Brain tasks use the central Agent queue. */
export function shouldLoadLegacyBrainTiers(_mode: unknown, _internalWorker: boolean): boolean {
  return false;
}
