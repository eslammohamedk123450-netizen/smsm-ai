import { canUploadUnboundMediaFeature } from "./upload_access.ts";

Deno.test("general library uploads are allowed for authenticated non-admin users", () => {
  if (!canUploadUnboundMediaFeature("general", false)) throw new Error("general library upload was incorrectly admin-gated");
});

Deno.test("HIMS resource uploads remain admin-only", () => {
  if (canUploadUnboundMediaFeature("hims", false)) throw new Error("non-admin HIMS upload was allowed");
  if (!canUploadUnboundMediaFeature("hims", true)) throw new Error("admin HIMS upload was rejected");
});
