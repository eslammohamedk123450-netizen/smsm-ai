import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CF_ACCOUNT_RE = /^[0-9a-f]{32}$/i;
const encoder = new TextEncoder();

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
function hex(bytes: Uint8Array): string { return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
async function sha1(value: string): Promise<string> { return hex(new Uint8Array(await crypto.subtle.digest("SHA-1", encoder.encode(value)))); }
function cloudinarySignature(fields: Record<string, string>, secret: string): Promise<string> {
  const canonical = Object.entries(fields).filter(([, value]) => value !== "").sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
  return sha1(`${canonical}${secret}`);
}
function parseCloudinaryUrl(value: string): { cloudName: string; apiKey: string; apiSecret: string } | null {
  if (!value || value.length > 2048) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "cloudinary:" || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== "/")) return null;
    const cloudName = parsed.hostname;
    const apiKey = decodeURIComponent(parsed.username);
    const apiSecret = decodeURIComponent(parsed.password);
    if (!/^[a-zA-Z0-9_-]+$/.test(cloudName) || !apiKey || !apiSecret) return null;
    return { cloudName, apiKey, apiSecret };
  } catch { return null; }
}
function imageFormat(bytes: Uint8Array): { mimeType: string; extension: string; format: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mimeType: "image/jpeg", extension: "jpg", format: "jpg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return { mimeType: "image/png", extension: "png", format: "png" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mimeType: "image/webp", extension: "webp", format: "webp" };
  return null;
}
function decodeBase64Image(raw: string): Uint8Array {
  const value = raw.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").trim();
  if (!value || value.length > 24 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new ServiceError(502, "لم يرجع مزود الصور ملفًا صالحًا.");
  try {
    const binary = atob(value);
    if (!binary.length || binary.length > 18 * 1024 * 1024) throw new Error("image size");
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch { throw new ServiceError(502, "تعذر قراءة الصورة التي أنشأها المزود."); }
}
async function getUserId(service: ReturnType<typeof createClient>, req: Request): Promise<string> {
  const authorization = req.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ServiceError(401, "سجّل الدخول قبل إنشاء صورة.");
  const { data, error } = await service.auth.getUser(match[1]);
  if (error || !data.user) throw new ServiceError(401, "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.");
  return data.user.id;
}
async function settleCredits(service: ReturnType<typeof createClient>, userId: string, taskId: string, actualCost: number): Promise<void> {
  const { error } = await service.rpc("finalize_credits", {
    p_user_id: userId,
    p_task_id: taskId,
    p_actual_cost: actualCost,
    p_input_tokens: 0,
    p_output_tokens: 0,
    p_model_id: null,
    p_source: "cloudflare_image_generation",
  });
  if (error) console.error("Image generation credit settlement failed.", error.code ?? "database_error");
}
async function uploadImageToCloudinary(input: {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  publicId: string;
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}): Promise<{ version: number; bytes: number; format: string; width: number | null; height: number | null }> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signedFields = { overwrite: "false", public_id: input.publicId, timestamp, type: "authenticated" };
  const signature = await cloudinarySignature(signedFields, input.apiSecret);
  const form = new FormData();
  form.set("file", new Blob([input.bytes], { type: input.mimeType }), `generated.${input.extension}`);
  form.set("public_id", input.publicId);
  form.set("timestamp", timestamp);
  form.set("type", "authenticated");
  form.set("overwrite", "false");
  form.set("api_key", input.apiKey);
  form.set("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(input.cloudName)}/image/upload`, { method: "POST", body: form });
  if (!response.ok) throw new ServiceError(502, "تعذر حفظ الصورة الخاصة في التخزين.");
  let uploaded: Record<string, unknown>;
  try { uploaded = asRecord(await response.json()); }
  catch { throw new ServiceError(502, "لم يقبل التخزين استجابة الرفع."); }
  const version = Number(uploaded.version);
  const bytes = Number(uploaded.bytes);
  const format = String(uploaded.format ?? input.extension).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (uploaded.public_id !== input.publicId || !Number.isSafeInteger(version) || version < 1 || !Number.isSafeInteger(bytes) || bytes < 1) {
    throw new ServiceError(502, "تعذر التحقق من الملف المحفوظ.");
  }
  return {
    version,
    bytes,
    format,
    width: Number.isFinite(Number(uploaded.width)) ? Number(uploaded.width) : null,
    height: Number.isFinite(Number(uploaded.height)) ? Number(uploaded.height) : null,
  };
}
async function destroyCloudinaryAsset(input: { publicId: string; cloudName: string; apiKey: string; apiSecret: string }): Promise<void> {
  try {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const fields = { public_id: input.publicId, timestamp, type: "authenticated" };
    const form = new FormData();
    form.set("public_id", fields.public_id);
    form.set("timestamp", fields.timestamp);
    form.set("type", fields.type);
    form.set("api_key", input.apiKey);
    form.set("signature", await cloudinarySignature(fields, input.apiSecret));
    await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(input.cloudName)}/image/destroy`, { method: "POST", body: form });
  } catch { /* best-effort cleanup only */ }
}

Deno.serve(async (req: Request) => {
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
  try { body = asRecord(await req.json()); }
  catch { return json(400, { error: "تعذر قراءة طلب توليد الصورة." }); }

  const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : "";
  const userMessageId = typeof body.user_message_id === "string" ? body.user_message_id : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!UUID_RE.test(conversationId) || !UUID_RE.test(userMessageId)) return json(400, { error: "معرّف المحادثة أو الرسالة غير صالح." });
  if (!prompt || prompt.length > 2048) return json(400, { error: "اكتب وصفًا للصورة بين حرف واحد و2048 حرفًا." });

  const { data: profile, error: profileError } = await service.from("suly_profiles").select("is_banned").eq("id", userId).maybeSingle();
  if (profileError || !profile) return json(403, { error: "تعذر التحقق من حسابك." });
  if (profile.is_banned) return json(403, { error: "هذا الحساب موقوف." });

  const { data: conversation, error: conversationError } = await service.from("suly_conversations").select("id").eq("id", conversationId).eq("user_id", userId).maybeSingle();
  if (conversationError || !conversation) return json(404, { error: "المحادثة غير موجودة أو لا تملك صلاحية الوصول إليها." });
  const { data: userMessage, error: messageError } = await service.from("suly_messages").select("id,content").eq("id", userMessageId).eq("conversation_id", conversationId).eq("user_id", userId).eq("role", "user").maybeSingle();
  if (messageError || !userMessage) return json(404, { error: "رسالة الطلب غير موجودة أو لا تخص هذه المحادثة." });
  if (String(userMessage.content ?? "").trim() !== prompt) return json(400, { error: "وصف الصورة يجب أن يطابق رسالة المحادثة المحفوظة." });

  const { data: configRows, error: configError } = await service.rpc("suly_service_get_cloudflare_image_config");
  const config = Array.isArray(configRows) ? asRecord(configRows[0]) : asRecord(configRows);
  if (configError || config.enabled !== true || typeof config.api_token !== "string" || !config.api_token || typeof config.account_id !== "string" || !CF_ACCOUNT_RE.test(config.account_id)) {
    return json(503, { error: "توليد الصور غير مفعّل أو إعداد Cloudflare غير مكتمل. تواصل مع المشرف." });
  }
  const cloudinary = parseCloudinaryUrl(Deno.env.get("cloudinary_URL") ?? Deno.env.get("CLOUDINARY_URL") ?? "");
  if (!cloudinary) return json(503, { error: "تخزين الصور الخاصة غير مهيأ على الخادم." });

  const creditsPerImage = Math.max(1, Math.floor(Number(config.credits_per_image) || 1));
  const { data: pricing, error: pricingError } = await service.from("suly_credit_pricing").select("enabled").eq("id", 1).maybeSingle();
  if (pricingError || !pricing) return json(503, { error: "إعدادات الرصيد غير متاحة حاليًا." });
  const requestId = crypto.randomUUID();
  let reserved = false;
  if (pricing.enabled === true) {
    const { data: reservation, error: reserveError } = await service.rpc("reserve_credits", {
      p_user_id: userId,
      p_task_id: requestId,
      p_amount: creditsPerImage,
      p_conversation_id: conversationId,
    });
    const reserve = asRecord(reservation);
    if (reserveError) {
      console.error("Image generation credit reservation failed.", reserveError.code ?? "database_error");
      return json(503, { error: "تعذر حجز رصيد توليد الصورة. حاول لاحقًا." });
    }
    if (reserve.success !== true) {
      return json(reserve.error === "insufficient_credits" ? 402 : 409, {
        error: reserve.error === "insufficient_credits" ? "رصيدك غير كافٍ لتوليد صورة." : "تعذر حجز رصيد الطلب.",
        required: reserve.required,
        balance: reserve.balance,
      });
    }
    if (reserve.already_reserved === true) return json(409, { error: "طلب توليد الصورة قيد التنفيذ بالفعل." });
    reserved = true;
  }

  let uploadedPublicId: string | null = null;
  let assistantMessageId: string | null = null;
  try {
    const controller = new AbortController();
    const abortForClientDisconnect = () => controller.abort();
    req.signal.addEventListener("abort", abortForClientDisconnect, { once: true });
    if (req.signal.aborted) controller.abort();
    const timeout = setTimeout(() => controller.abort(), 75_000);
    let cfResponse: Response;
    try {
      cfResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/ai/run/${MODEL}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.api_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, steps: 4 }),
        signal: controller.signal,
      });
    } catch {
      throw new ServiceError(502, "تعذر الاتصال بخدمة Cloudflare لتوليد الصورة.");
    } finally {
      clearTimeout(timeout);
      req.signal.removeEventListener("abort", abortForClientDisconnect);
    }

    if (!cfResponse.ok) {
      const status = cfResponse.status;
      if (status === 401 || status === 403) throw new ServiceError(502, "رفض Cloudflare الرمز أو صلاحية Workers AI. راجع إعدادات المشرف.");
      if (status === 429) throw new ServiceError(429, "وصلت خدمة الصور إلى حد الطلبات مؤقتًا. حاول بعد قليل.");
      throw new ServiceError(502, `تعذر توليد الصورة من Cloudflare (HTTP ${status}).`);
    }
    const cfPayload = asRecord(await cfResponse.json());
    const result = asRecord(cfPayload.result);
    if (cfPayload.success !== true || typeof result.image !== "string") throw new ServiceError(502, "لم يرجع Cloudflare صورة قابلة للحفظ.");
    const bytes = decodeBase64Image(result.image);
    const format = imageFormat(bytes);
    if (!format) throw new ServiceError(502, "صيغة الصورة التي رجعها المزود غير مدعومة.");

    const assetId = crypto.randomUUID();
    const publicId = `suly/${userId}/chat/${assetId}`;
    uploadedPublicId = publicId;
    const uploaded = await uploadImageToCloudinary({
      bytes,
      mimeType: format.mimeType,
      extension: format.extension,
      publicId,
      cloudName: cloudinary.cloudName,
      apiKey: cloudinary.apiKey,
      apiSecret: cloudinary.apiSecret,
    });

    const { data: assistantMessage, error: assistantError } = await service.from("suly_messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "assistant",
      content: "تم إنشاء الصورة.",
      tokens_used: 0,
      model_id: null,
      status: "sent",
    }).select("id").single();
    if (assistantError || !assistantMessage) throw new ServiceError(500, "تم توليد الصورة لكن تعذر حفظ رد المحادثة.");
    assistantMessageId = String(assistantMessage.id);

    const { error: assetError } = await service.from("global_media_assets").insert({
      id: assetId,
      user_id: userId,
      feature_key: "chat",
      storage_provider: "cloudinary",
      bucket: "image",
      object_key: publicId,
      public_url: null,
      mime_type: format.mimeType,
      size_bytes: uploaded.bytes,
      original_filename: `generated-image.${format.extension}`,
      metadata: {
        kind: "image",
        format: uploaded.format || format.format,
        version: uploaded.version,
        width: uploaded.width,
        height: uploaded.height,
        generated: true,
        generation_provider: "cloudflare_workers_ai",
        model: MODEL,
      },
      delivery_type: "authenticated",
      conversation_id: conversationId,
      message_id: assistantMessageId,
      support_ticket_id: null,
    });
    if (assetError) throw new ServiceError(500, "تم توليد الصورة لكن تعذر ربطها برسالة المحادثة.");

    const { error: updateConversationError } = await service.from("suly_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", userId);
    if (updateConversationError) console.error("Generated image conversation timestamp update failed.", updateConversationError.code ?? "database_error");
    if (reserved) await settleCredits(service, userId, requestId, creditsPerImage);
    return json(200, { success: true, message_id: assistantMessageId, media_id: assetId, model: MODEL });
  } catch (error) {
    if (assistantMessageId) await service.from("suly_messages").delete().eq("id", assistantMessageId).eq("user_id", userId);
    if (uploadedPublicId) await destroyCloudinaryAsset({ publicId: uploadedPublicId, cloudName: cloudinary.cloudName, apiKey: cloudinary.apiKey, apiSecret: cloudinary.apiSecret });
    if (reserved) await settleCredits(service, userId, requestId, 0);
    if (error instanceof ServiceError) return json(error.status, { error: error.message });
    console.error("Image generation failed.");
    return json(502, { error: "تعذر إكمال إنشاء الصورة. لم يُخصم رصيد الصورة عند فشل العملية." });
  }
});
