// Billing and provider-origin guards are enforced before a media credit hold is created.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { actualChargeCredits, actualCostUsd, providerEndpointAllowed, validateEnabledMediaPrice } from "./cost.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEDIA_BUCKET = "suly-media";
const MAX_IMAGE_BYTES = 18 * 1024 * 1024;

type MediaModel = {
  id: string;
  service_type: "image";
  display_name: string;
  provider_id: number;
  model_identifier: string;
  protocol: "openai_images";
  endpoint_url: string;
  allowed_tiers: string[];
  supported_qualities: string[];
};
type MediaPrice = {
  id: string;
  generation_model_id: string;
  quality: string;
  price_credits: number;
  estimated_provider_cost_usd: number;
  target_margin: number;
  credit_value_egp: number;
  usd_to_egp: number;
  resolution: string;
  enabled: boolean;
  price_version: number;
};

class ServiceError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function imageFormat(bytes: Uint8Array): { mimeType: string; extension: string; format: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mimeType: "image/jpeg", extension: "jpg", format: "jpg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return { mimeType: "image/png", extension: "png", format: "png" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mimeType: "image/webp", extension: "webp", format: "webp" };
  return null;
}
function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (bytes.length >= 10 && String.fromCharCode(...bytes.slice(0, 3)) === "GIF") {
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    && String.fromCharCode(...bytes.slice(12, 16)) === "VP8X") {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        return width > 0 && height > 0 ? { width, height } : null;
      }
      offset += 2 + segmentLength;
    }
  }
  return null;
}
function decodeBase64Image(raw: string): Uint8Array {
  const value = raw.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").trim();
  if (!value || value.length > 24 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new ServiceError(502, "لم يرجع مزود الصور ملفًا صالحًا.");
  try {
    const binary = atob(value);
    if (!binary.length || binary.length > MAX_IMAGE_BYTES) throw new Error("image size");
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch { throw new ServiceError(502, "تعذر قراءة الصورة التي أنشأها المزود."); }
}
async function getUserId(service: SupabaseClient<any, "public", any>, req: Request): Promise<string> {
  const authorization = req.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ServiceError(401, "سجّل الدخول قبل إنشاء صورة.");
  const { data, error } = await service.auth.getUser(match[1]);
  if (error || !data.user) throw new ServiceError(401, "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.");
  return data.user.id;
}
async function settleCredits(service: SupabaseClient<any, "public", any>, userId: string, taskId: string, actualCost: number): Promise<boolean> {
  const { data, error } = await service.rpc("finalize_credits", {
    p_user_id: userId, p_task_id: taskId, p_actual_cost: actualCost,
    p_input_tokens: 0, p_output_tokens: 0, p_model_id: null, p_source: "external_image_generation",
  });
  if (error) {
    console.error("Image generation credit settlement is pending.", error.code ?? "database_error");
    return false;
  }
  const result = asRecord(data);
  if (result.success !== true) return false;
  const charged = Number(result.charged ?? 0);
  const settledActual = Number(result.actual_cost ?? 0);
  // An expired hold is idempotent too, but it is not a successful charge.
  // Do not report billing as settled unless this exact amount was recorded.
  return Number.isSafeInteger(charged) && charged === actualCost
    && Number.isSafeInteger(settledActual) && settledActual === actualCost;
}
async function uploadImageToStorage(input: { bytes: Uint8Array; mimeType: string; objectKey: string; service: SupabaseClient<any, "public", any> }): Promise<void> {
  const body = new Blob([input.bytes.slice().buffer as ArrayBuffer], { type: input.mimeType });
  const { error } = await input.service.storage.from(MEDIA_BUCKET).upload(input.objectKey, body, { contentType: input.mimeType, upsert: false });
  if (error) throw new ServiceError(502, "تعذر حفظ الصورة.");
}
async function removeStoredImage(service: SupabaseClient<any, "public", any>, objectKey: string): Promise<void> {
  try { await service.storage.from(MEDIA_BUCKET).remove([objectKey]); } catch { /* best-effort cleanup */ }
}
async function callImageProvider(input: {
  model: MediaModel; price: MediaPrice; apiKey: string; prompt: string; quality: string;
}): Promise<{ bytes: Uint8Array; costUsd: number; costConfirmed: boolean; providerRequestId: string | null }> {
  const endpoint = new URL(input.model.endpoint_url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) throw new ServiceError(503, "عنوان مزود الصور غير صالح. راجع إعدادات المشرف.");
  if (input.model.protocol !== "openai_images") throw new ServiceError(501, "بروتوكول نموذج الصور غير مدعوم حاليًا.");
  const providerQuality = input.quality === "economy" ? "low" : input.quality === "standard" ? "medium" : input.quality === "ultra" ? "high" : input.quality;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  let response: Response;
  try {
    response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        model: input.model.model_identifier,
        prompt: input.prompt,
        size: input.price.resolution,
        quality: providerQuality,
        n: 1,
      }),
      signal: controller.signal,
      redirect: "error",
    });
  } catch {
    throw new ServiceError(502, "تعذر الاتصال بمزود الصور الخارجي. حاول مرة أخرى لاحقًا.");
  } finally { clearTimeout(timeout); }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new ServiceError(502, "رفض مزود الصور مفتاح API أو صلاحية الاستخدام.");
    if (response.status === 429) throw new ServiceError(429, "وصل مزود الصور إلى حد الطلبات مؤقتًا. حاول بعد قليل.");
    throw new ServiceError(502, `فشل مزود الصور الخارجي (HTTP ${response.status}).`);
  }
  const payload = asRecord(await response.json().catch(() => null));
  const data = Array.isArray(payload.data) ? asRecord(payload.data[0]) : {};
  if (typeof data.b64_json !== "string") throw new ServiceError(502, "لم يرجع مزود الصور صورة بصيغة base64 المدعومة.");
  const bytes = decodeBase64Image(data.b64_json);
  const format = imageFormat(bytes);
  if (!format) throw new ServiceError(502, "صيغة الصورة التي رجعها المزود غير مدعومة.");
  const cost = actualCostUsd(payload, input.price.estimated_provider_cost_usd);
  return { bytes, costUsd: cost.value, costConfirmed: cost.confirmed, providerRequestId: response.headers.get("x-request-id") };
}

async function handleImageGeneratorRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "الطريقة غير مدعومة." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json(503, { error: "خدمة الصور غير مهيأة على الخادم." });
  const service = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let userId: string;
  try { userId = await getUserId(service, req); }
  catch (error) { return json(error instanceof ServiceError ? error.status : 401, { error: error instanceof ServiceError ? error.message : "سجّل الدخول مرة أخرى." }); }

  let body: Record<string, unknown>;
  try { body = asRecord(await req.json()); } catch { return json(400, { error: "تعذر قراءة طلب توليد الصورة." }); }

  const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : "";
  const userMessageId = typeof body.user_message_id === "string" ? body.user_message_id : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const requestedModelId = typeof body.generation_model_id === "string" ? body.generation_model_id : "";
  const quality = typeof body.quality === "string" ? body.quality : "standard";
  const requestId = typeof body.request_id === "string" && UUID_RE.test(body.request_id) ? body.request_id : crypto.randomUUID();
  const studioRequest = body.source === "image_studio";
  if (!studioRequest || conversationId || userMessageId) return json(400, { error: "توليد الصور متاح من استوديو SULY فقط. افتح الاستوديو وأكّد الطلب هناك." });
  if (!UUID_RE.test(requestId)) return json(400, { error: "معرّف طلب التوليد غير صالح." });
  if (!prompt || prompt.length > 2048) return json(400, { error: "اكتب وصفًا للصورة بين حرف واحد و2048 حرفًا." });
  if (!["economy","standard","high","ultra"].includes(quality)) return json(400, { error: "جودة الصورة المحددة غير مدعومة." });

  const { data: profile, error: profileError } = await service.from("suly_profiles").select("is_banned").eq("id", userId).maybeSingle();
  if (profileError || !profile) return json(403, { error: "تعذر التحقق من حسابك." });
  if (profile.is_banned) return json(403, { error: "هذا الحساب موقوف." });
  const { data: effectiveTier, error: effectiveTierError } = await service.rpc("suly_effective_subscription_tier", { p_user_id: userId });
  if (effectiveTierError || typeof effectiveTier !== "string") {
    console.error("Effective media subscription entitlement verification failed.");
    return json(503, { error: "تعذر التحقق من صلاحيات الباقة. حاول مرة أخرى." });
  }
  const userTier = ["free","lite","pro","max","ultra_team"].includes(effectiveTier) ? effectiveTier : "free";

  const { data: existingAsset } = await service.from("global_media_assets").select("id,message_id,metadata")
    .eq("user_id", userId).contains("metadata", { request_id: requestId }).maybeSingle();
  if (existingAsset) {
    const existingMetadata = asRecord(existingAsset.metadata);
    const existingCharge = Number(existingMetadata.charged_credits ?? 0);
    const billingSettled = await settleCredits(service, userId, requestId, Number.isSafeInteger(existingCharge) && existingCharge >= 0 ? existingCharge : 0);
    return json(200, {
      success: true, request_id: requestId, media_id: existingAsset.id, message_id: existingAsset.message_id ?? null,
      already_completed: true, metadata: existingMetadata,
      billing_status: billingSettled ? "settled" : "pending_reconciliation",
    });
  }
  const { data: existingJob } = await service.from("suly_media_generation_jobs")
    .select("status,output_asset_id,charged_credits,provider_cost_usd,provider_cost_status")
    .eq("id", requestId).eq("user_id", userId).maybeSingle();
  if (existingJob) {
    if (existingJob.status === "queued" || existingJob.status === "running") {
      return json(202, { success: true, request_id: requestId, status: existingJob.status, message: "الطلب قيد التنفيذ بالفعل." });
    }
    if (existingJob.status === "failed" || existingJob.status === "cancelled" || existingJob.status === "completed") {
      return json(409, { error: "هذا الطلب انتهى أو لم تعد نتيجته متاحة. ابدأ طلبًا جديدًا لإعادة المحاولة.", request_id: requestId });
    }
  }

  let modelQuery = service.from("suly_media_generation_models")
    .select("id,service_type,display_name,provider_id,model_identifier,protocol,endpoint_url,allowed_tiers,supported_qualities")
    .eq("service_type", "image").eq("is_active", true);
  if (requestedModelId) modelQuery = modelQuery.eq("id", requestedModelId);
  else modelQuery = modelQuery.eq("is_default", true);
  const { data: model, error: modelError } = await modelQuery.maybeSingle();
  if (modelError || !model) return json(503, { error: "لا يوجد نموذج صور خارجي مفعّل. اطلب من المشرف ربط مزود ونموذج صور." });
  const mediaTierRank: Record<string, number> = { free: 0, lite: 1, pro: 2, max: 3, ultra_team: 4 };
  const mediaUserRank = mediaTierRank[userTier] ?? 0;
  const mediaTierAllowed = (model.allowed_tiers ?? []).some((tier: string) =>
    mediaTierRank[tier] !== undefined && mediaTierRank[tier] <= mediaUserRank);
  if (!mediaTierAllowed) return json(403, { error: "هذا النموذج غير متاح ضمن اشتراكك الحالي." });
  if (!(model.supported_qualities ?? []).includes(quality)) return json(422, { error: "الجودة المحددة غير مدعومة لهذا النموذج." });

  const { data: price, error: priceError } = await service.from("suly_media_generation_prices")
    .select("id,generation_model_id,quality,price_credits,estimated_provider_cost_usd,target_margin,credit_value_egp,usd_to_egp,resolution,enabled,price_version")
    .eq("generation_model_id", model.id).eq("quality", quality).eq("enabled", true).maybeSingle();
  if (priceError || !price) return json(503, { error: "لم يحدد المشرف سعر هذه الجودة بعد." });
  const typedModel = model as MediaModel;
  const typedPrice = price as MediaPrice;
  const priceValidation = validateEnabledMediaPrice(typedPrice);
  if (!priceValidation.valid) {
    return json(503, { error: "إعدادات سعر هذه الجودة غير مكتملة أو أقل من تكلفة المزود والهامش المحدد." });
  }

  const { data: provider, error: providerError } = await service.from("ai_providers")
    .select("base_url,enabled").eq("id", typedModel.provider_id).maybeSingle();
  if (providerError || !provider?.enabled || !providerEndpointAllowed(typedModel.endpoint_url, provider.base_url)) {
    return json(503, { error: "عنوان نقطة توليد الصور لا يطابق عنوان المزود الموثوق أو أن المزود غير مفعّل." });
  }

  const { data: apiKey, error: keyError } = await service.rpc("suly_service_get_provider_api_key", { p_provider_id: typedModel.provider_id });
  if (keyError || typeof apiKey !== "string" || !apiKey) return json(503, { error: "مفتاح مزود الصور غير متاح في Vault. راجع إعدادات المزود." });

  const { data: reservation, error: reserveError } = await service.rpc("reserve_credits", {
    p_user_id: userId, p_task_id: requestId, p_amount: typedPrice.price_credits, p_conversation_id: conversationId || null,
  });
  const reserve = asRecord(reservation);
  if (reserveError) return json(503, { error: "تعذر حجز رصيد توليد الصورة." });
  if (reserve.success !== true) return json(reserve.error === "insufficient_credits" ? 402 : 409, {
    error: reserve.error === "insufficient_credits" ? "رصيدك غير كافٍ لتوليد هذه الصورة." : "تعذر حجز رصيد الطلب.",
    required: reserve.required, balance: reserve.balance,
  });
  if (reserve.already_reserved === true) return json(409, { error: "هذا الطلب قيد التنفيذ بالفعل.", request_id: requestId });

  const { error: jobInsertError } = await service.from("suly_media_generation_jobs").insert({
    id: requestId, user_id: userId, service_type: "image", generation_model_id: typedModel.id,
    status: "running", prompt, quality, estimated_credits: typedPrice.price_credits,
    reserved_credits: typedPrice.price_credits, started_at: new Date().toISOString(),
    metadata: { source: studioRequest ? "image_studio" : "chat", price_version: typedPrice.price_version },
  });
  if (jobInsertError) {
    await settleCredits(service, userId, requestId, 0).catch(() => undefined);
    return json(503, { error: "تعذر تسجيل مهمة الصورة في المكتبة. تم تحرير الحجز.", request_id: requestId });
  }

  const runGeneration = async (): Promise<Response> => {
  let uploadedObjectKey: string | null = null;
  let assistantMessageId: string | null = null;
  let assetId: string | null = null;
  // A live generation refreshes its lease so the recovery job never refunds
  // a request that is still running at the provider.
  const heartbeat = setInterval(() => {
    void service.from("suly_media_generation_jobs")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", requestId).eq("user_id", userId).eq("status", "running")
      .then(
        ({ error }) => {
          if (error) console.error("Media generation heartbeat failed.", error.code ?? "database_error");
        },
        () => undefined,
      );
  }, 30_000);
  try {
    const generated = await callImageProvider({ model: typedModel, price: typedPrice, apiKey, prompt, quality });
    const format = imageFormat(generated.bytes);
    if (!format) throw new ServiceError(502, "صيغة الصورة التي رجعها المزود غير مدعومة.");
    const dimensions = imageDimensions(generated.bytes);

    const actualCredits = actualChargeCredits(generated.costUsd, typedPrice, generated.costConfirmed);
    const imageId = crypto.randomUUID();
    assetId = imageId;
    const objectKey = `${userId}/generated/${imageId}.${format.extension}`;
    uploadedObjectKey = objectKey;
    await uploadImageToStorage({ bytes: generated.bytes, mimeType: format.mimeType, objectKey, service });

    if (!studioRequest) {
      const { data: assistantMessage, error: assistantError } = await service.from("suly_messages").insert({
        conversation_id: conversationId, user_id: userId, role: "assistant", content: "تم إنشاء الصورة.",
        tokens_used: 0, model_id: null, status: "sent",
      }).select("id").single();
      if (assistantError || !assistantMessage) throw new ServiceError(500, "تم إنشاء الصورة لكن تعذر حفظ رد المحادثة.");
      assistantMessageId = String(assistantMessage.id);
    }

    const { error: assetError } = await service.from("global_media_assets").insert({
      id: imageId, user_id: userId, feature_key: studioRequest ? "general" : "chat", storage_provider: "supabase",
      bucket: MEDIA_BUCKET, object_key: objectKey, public_url: null, mime_type: format.mimeType,
      size_bytes: generated.bytes.byteLength, original_filename: `suly-image.${format.extension}`,
      metadata: {
        kind: "image", format: format.format, generated: true, prompt,
        public_model_name: typedModel.display_name, quality, resolution: typedPrice.resolution,
        estimated_credits: typedPrice.price_credits, requested_credits: actualCredits,
        width: dimensions?.width ?? null, height: dimensions?.height ?? null,
        request_id: requestId, source: studioRequest ? "image_studio" : "chat",
      },
      delivery_type: "authenticated", conversation_id: studioRequest ? null : conversationId, message_id: assistantMessageId, support_ticket_id: null,
    });
    if (assetError) throw new ServiceError(500, "تم إنشاء الصورة لكن تعذر حفظها في المكتبة.");

    const creditsSettled = await settleCredits(service, userId, requestId, actualCredits);
    const revenueEgp = creditsSettled ? actualCredits * typedPrice.credit_value_egp : null;
    const providerCostEgp = generated.costUsd * typedPrice.usd_to_egp;
    const { error: ledgerError } = await service.from("suly_company_cost_ledger").insert({
      request_id: requestId, user_id: userId, service_type: "image", provider_id: typedModel.provider_id,
      generation_model_id: typedModel.id, provider_model_identifier: typedModel.model_identifier,
      provider_cost_usd: generated.costUsd, cost_status: generated.costConfirmed ? "confirmed" : "estimated",
      user_credits_charged: creditsSettled ? actualCredits : 0, credit_value_egp: typedPrice.credit_value_egp,
      usd_to_egp: typedPrice.usd_to_egp, revenue_egp: revenueEgp, provider_cost_egp: providerCostEgp,
      other_cost_egp: 0, gross_profit_egp: revenueEgp === null ? null : revenueEgp - providerCostEgp,
      price_version: String(typedPrice.price_version),
      metadata: { quality, resolution: typedPrice.resolution, generation_model_id: typedModel.id, provider_request_id: generated.providerRequestId, billing_status: creditsSettled ? "settled" : "pending_reconciliation", requested_credits: actualCredits },
    });
    if (ledgerError && ledgerError.code !== "23505") console.error("Company cost ledger insert failed.", ledgerError.code ?? "database_error");
    await service.from("suly_media_generation_jobs").update({
      status: "completed", charged_credits: creditsSettled ? actualCredits : 0, provider_cost_usd: generated.costUsd,
      provider_cost_status: generated.costConfirmed ? "confirmed" : "estimated",
      provider_request_id: generated.providerRequestId, output_asset_id: imageId,
      completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      metadata: { source: studioRequest ? "image_studio" : "chat", price_version: typedPrice.price_version, billing_status: creditsSettled ? "settled" : "pending_reconciliation" },
    }).eq("id", requestId).eq("user_id", userId);

    if (!studioRequest) await service.from("suly_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", userId);
    return json(200, {
      success: true, request_id: requestId, message_id: assistantMessageId, media_id: imageId,
      model: typedModel.display_name,
      estimated_credits: typedPrice.price_credits, requested_credits: actualCredits,
      charged_credits: creditsSettled ? actualCredits : 0,
      billing_status: creditsSettled ? "settled" : "pending_reconciliation",
    });
  } catch (error) {
    await service.from("suly_media_generation_jobs").update({
      status: "failed", error_code: error instanceof ServiceError ? `http_${error.status}` : "generation_failed",
      error_message: error instanceof Error ? error.message.slice(0, 500) : "Generation failed",
      completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", requestId).eq("user_id", userId);
    if (assistantMessageId) await service.from("suly_messages").delete().eq("id", assistantMessageId).eq("user_id", userId);
    if (assetId) await service.from("global_media_assets").delete().eq("id", assetId).eq("user_id", userId);
    if (uploadedObjectKey) await removeStoredImage(service, uploadedObjectKey);
    await settleCredits(service, userId, requestId, 0).catch(() => undefined);
    if (error instanceof ServiceError) return json(error.status, { error: error.message, request_id: requestId });
    console.error("External image generation failed.");
    return json(502, { error: "تعذر إكمال إنشاء الصورة. تم تحرير الحجز عند فشل التنفيذ.", request_id: requestId });
  } finally {
    clearInterval(heartbeat);
  }
  };

  if (studioRequest) {
    EdgeRuntime.waitUntil(runGeneration());
    return json(202, { success: true, request_id: requestId, job_id: requestId, status: "running" });
  }
  return await runGeneration();
}

Deno.serve(async (request: Request) => {
  const configuredOrigins = Deno.env.get("WEB_CORS_ORIGIN") ?? "";
  const preflight = handleCorsPreflight(request, configuredOrigins);
  if (preflight) return preflight;
  let response: Response;
  try {
    response = await handleImageGeneratorRequest(request);
  } catch {
    response = json(500, { error: "تعذر إكمال طلب إنشاء الصورة." });
  }
  return withCors(request, response, configuredOrigins);
});
