export type UnboundMediaFeature = "hims" | "general";

/** General Library uploads are available to any authenticated, non-banned user.
 * HIMS resource uploads remain admin-managed.
 */
export function canUploadUnboundMediaFeature(feature: UnboundMediaFeature, isAdmin: boolean): boolean {
  return feature === "general" || isAdmin;
}
