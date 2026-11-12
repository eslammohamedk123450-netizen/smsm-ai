// Global infrastructure: feature activation service.
//
// The backend never hard-codes a feature name. It asks the database which
// features exist, which profile column each one maps to, and which resource
// links belong to them. HIMS is one row in that registry; adding a second
// feature is a data operation.

import { interpretActivationResponse, type ActivationResult } from "./activation_command.ts";
import { normalizeFeatureKey } from "./prompt_keys.ts";
import { cloudinaryAuthenticatedDeliveryUrl } from "./cloudinary_delivery.ts";

export interface FeatureResource {
  title: string;
  url: string;
  kind: string;
  description: string | null;
}

export interface FeatureInfo {
  label: string;
  activated: boolean;
  resources: FeatureResource[];
}

export interface FeatureContext {
  features: Record<string, FeatureInfo>;
}

export type FeatureStatus = Record<string, boolean>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function getFeatureStatus(supabase: any, userId: string): Promise<FeatureStatus> {
  try {
    const { data, error } = await supabase.rpc("suly_feature_status", { p_user_id: userId });
    if (error) throw new Error(error.message);
    const record = asRecord(data);
    const status: FeatureStatus = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "boolean") status[key] = value;
    }
    return status;
  } catch (error) {
    console.warn("Could not read feature status:", error instanceof Error ? error.message : String(error));
    return {};
  }
}

export async function getFeatureContext(supabase: any, userId: string): Promise<FeatureContext> {
  try {
    const { data, error } = await supabase.rpc("suly_feature_context", { p_user_id: userId });
    if (error) throw new Error(error.message);
    const features = asRecord(asRecord(data).features);
    const parsed: Record<string, FeatureInfo> = {};
    for (const [key, value] of Object.entries(features)) {
      const entry = asRecord(value);
      const resources = Array.isArray(entry.resources) ? entry.resources : [];
      parsed[key] = {
        label: typeof entry.label === "string" ? entry.label : key,
        activated: entry.activated === true,
        resources: resources.map((item) => {
          const resource = asRecord(item);
          return {
            title: String(resource.title ?? ""),
            url: String(resource.url ?? ""),
            kind: String(resource.kind ?? "link"),
            description: typeof resource.description === "string" ? resource.description : null,
          };
        }).filter((resource) => resource.title.length > 0 && /^https:\/\//i.test(resource.url)),
      };
    }
    const activeKeys = Object.entries(parsed).filter(([, info]) => info.activated).map(([key]) => key);
    for (const [key, info] of Object.entries(parsed)) if (!info.activated) info.resources = [];
    if (activeKeys.length) {
      const { data: resourceRows, error: resourceError } = await supabase.from("suly_feature_resources")
        .select("feature_key,title,url,media_asset_id,kind,description")
        .in("feature_key", activeKeys).eq("is_active", true).limit(200);
      if (resourceError) throw new Error(resourceError.message);
      const rows = (resourceRows ?? []) as Array<Record<string, unknown>>;
      const mediaIds = [...new Set(rows.map((row) => typeof row.media_asset_id === "string" ? row.media_asset_id : "").filter(Boolean))];
      const assetsById = new Map<string, Record<string, unknown>>();
      if (mediaIds.length) {
        const { data: assets, error: assetsError } = await supabase.from("global_media_assets")
          .select("id,feature_key,storage_provider,bucket,object_key,metadata,delivery_type")
          .in("id", mediaIds).limit(200);
        if (assetsError) throw new Error(assetsError.message);
        for (const asset of assets ?? []) assetsById.set(String(asset.id), asset as Record<string, unknown>);
      }
      const resourcesByFeature = new Map<string, FeatureResource[]>();
      for (const row of rows) {
        const featureKey = String(row.feature_key ?? "");
        let url: string | null = typeof row.url === "string" && /^https:\/\//i.test(row.url) ? row.url : "";
        const mediaId = typeof row.media_asset_id === "string" ? row.media_asset_id : "";
        if (mediaId) {
          const asset = assetsById.get(mediaId);
          if (asset && asset.feature_key === featureKey && asset.delivery_type === "authenticated") {
            if (asset.storage_provider === "supabase") {
              const { data: signed, error: signedError } = await supabase.storage.from(String(asset.bucket)).createSignedUrl(String(asset.object_key), 3600);
              url = !signedError && signed?.signedUrl ? signed.signedUrl : null;
            } else if (asset.storage_provider === "cloudinary") {
              url = await cloudinaryAuthenticatedDeliveryUrl({ bucket: String(asset.bucket), object_key: String(asset.object_key), metadata: asRecord(asset.metadata) }, supabase);
            }
          }
        }
        if (!url) continue;
        const current = resourcesByFeature.get(featureKey) ?? [];
        current.push({ title: String(row.title ?? ""), url, kind: String(row.kind ?? "link"), description: typeof row.description === "string" ? row.description : null });
        resourcesByFeature.set(featureKey, current);
      }
      for (const key of activeKeys) parsed[key].resources = resourcesByFeature.get(key) ?? [];
    }
    return { features: parsed };
  } catch (error) {
    console.warn("Could not read feature context:", error instanceof Error ? error.message : String(error));
    return { features: {} };
  }
}

/**
 * Builds the prompt block describing activated features and their links. It is
 * generated from data, so a new feature needs no code change here.
 */
export function buildFeatureSystemContext(context: FeatureContext): string | null {
  const activated = Object.entries(context.features).filter(([, info]) => info.activated);
  if (activated.length === 0) return null;
  const lines: string[] = [
    "The user has activated the following features in this application.",
    "Use their resource links and the shared tools when the user asks for that content.",
    "Never invent files or links that are not listed here.",
  ];
  for (const [key, info] of activated) {
    lines.push(`- ${info.label} (feature_key: ${key})`);
    for (const resource of info.resources) {
      lines.push(`  - ${resource.title}: ${resource.url}${resource.description ? ` — ${resource.description}` : ""}`);
    }
    if (info.resources.length === 0) {
      lines.push("  - No resource links are registered for this feature yet.");
    }
  }
  return lines.join("\n");
}

/** Activates any feature by code. The feature itself is decided by the code row. */
export async function activateFeatureByCode(supabase: any, userId: string, code: string): Promise<ActivationResult> {
  try {
    const { data, error } = await supabase.rpc("suly_activate_feature", {
      p_user_id: userId,
      p_code: code,
    });
    if (error) throw new Error(error.message);
    return interpretActivationResponse(data);
  } catch (error) {
    console.warn("Feature activation failed:", error instanceof Error ? error.message : String(error));
    return { outcome: "unavailable", featureKey: null, label: null, activationMessage: null };
  }
}

export function normalizeFeatureRequest(value: unknown): string {
  return normalizeFeatureKey(value);
}
