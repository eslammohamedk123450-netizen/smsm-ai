import { supabase } from "../../lib/supabase/client";
import { getMediaDeliveryUrl } from "../media/media-service";

export interface HimsFeatureStatus {
  label?: string;
  activated: boolean;
}
export interface HimsResource {
  id: string;
  title: string;
  url: string;
  kind: string;
  description: string | null;
  createdAt: string;
}

export async function getHimsFeatureStatus(): Promise<HimsFeatureStatus | null> {
  const { data, error } = await supabase.rpc("suly_my_feature_status");
  if (error) throw new Error("تعذر التحقق من تفعيل HIMS. حاول مرة أخرى.");
  const features = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const value = features.hims;
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return {
    label: typeof item.label === "string" ? item.label : "HIMS",
    activated: item.activated === true,
  };
}

export async function listMyHimsResources(): Promise<HimsResource[]> {
  const { data, error } = await supabase.rpc("suly_my_feature_resources", {
    p_limit: 200,
    p_offset: 0,
  });
  if (error) throw new Error("تعذر تحميل محتوى HIMS. تحقق من تفعيل النظام ثم حاول مجددًا.");
  const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
  return Promise.all(rows.map(async (row) => {
    const mediaId = typeof row.media_asset_id === "string" ? row.media_asset_id : null;
    let url = typeof row.url === "string" ? row.url : "";
    if (mediaId) {
      try {
        url = await getMediaDeliveryUrl(mediaId);
      } catch {
        url = "";
      }
    }
    return {
      id: String(row.id ?? ""),
      title: String(row.title ?? "مورد HIMS"),
      url,
      kind: String(row.kind ?? "file"),
      description: typeof row.description === "string" ? row.description : null,
      createdAt: String(row.created_at ?? ""),
    };
  }));
}
