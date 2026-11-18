import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, Linking, Pressable, ScrollView, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { randomUUID } from "expo-crypto";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import { supabase } from "../../lib/supabase/client";
import { getCurrentCreditBalance } from "../credits/credit-service";
import { getMediaDeliveryUrl, listMyGenerationJobs, type MediaAsset } from "../media/media-service";
import { chatService } from "../chat/chat-service";
import { useAppLocale } from "../../theme/LocaleProvider";

type Price = { quality: string; price_credits: number; resolution: string };
type Model = { id: string; display_name: string; supported_qualities: string[]; is_default: boolean; prices: Price[] };
type GeneratedImage = { id: string; url: string; prompt: string; modelName: string; quality: string; credits: number; billingStatus: string };
const QUALITY_LABELS: Record<string, string> = { economy: "اقتصادية", standard: "متوسطة", high: "عالية", ultra: "فائقة" };
const QUALITY_LABELS_EN: Record<string, string> = { economy: "Economy", standard: "Standard", high: "High", ultra: "Ultra" };

export function ImageStudioScreen() {
  const { colors } = useSulyTheme();
  const router = useRouter();
  const { isArabic } = useAppLocale();
  const locale = isArabic ? "ar-EG" : "en-US";
  const textAlign = isArabic ? "right" as const : "left" as const;
  const rowDirection = isArabic ? "row-reverse" as const : "row" as const;
  const qualityLabel = (value: string) => (isArabic ? QUALITY_LABELS[value] : QUALITY_LABELS_EN[value]) ?? value;
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [quality, setQuality] = useState("standard");
  const [prompt, setPrompt] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ prompt: string; quality: string; id: string } | null>(null);
  const breathingScale = useRef(new Animated.Value(1)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!generating) { breathingScale.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathingScale, { toValue: 1.018, duration: 1250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breathingScale, { toValue: 1, duration: 1250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [generating, breathingScale]);

  useEffect(() => {
    if (!result) { resultOpacity.setValue(0); return; }
    Animated.timing(resultOpacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [result, resultOpacity]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [modelResult, balanceResult] = await Promise.all([
        supabase.rpc("suly_list_public_image_models"),
        getCurrentCreditBalance().catch(() => null),
      ]);
      if (modelResult.error) {
        setModels([]);
        setSelectedModelId(null);
        setBalance(null);
        setError(isArabic ? "تعذر تحميل إعدادات استوديو الصور. أعد المحاولة قبل إنشاء أي صورة." : "Could not load Image Studio settings. Retry before generating an image.");
        return;
      }
      const allowed = (Array.isArray(modelResult.data) ? modelResult.data : []) as Model[];
      setModels(allowed);
      setSelectedModelId((current) => current && allowed.some((model) => model.id === current) ? current : allowed[0]?.id ?? null);
      setBalance(typeof balanceResult === "number" ? balanceResult : null);
    } catch {
      setModels([]);
      setSelectedModelId(null);
      setBalance(null);
      setError(isArabic ? "تعذر الاتصال باستوديو الصور. تحقق من الاتصال ثم أعد المحاولة." : "Could not connect to Image Studio. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [isArabic]);
  useEffect(() => { void load(); }, [load]);

  const selectedModel = models.find((model) => model.id === selectedModelId) ?? null;
  const availableQualities = selectedModel?.prices.map((price) => price.quality)
    .filter((item) => selectedModel.supported_qualities.includes(item)) ?? [];
  const effectiveQuality = availableQualities.includes(quality) ? quality : availableQualities[0] ?? "standard";
  const selectedPrice = selectedModel?.prices.find((price) => price.quality === effectiveQuality) ?? null;
  const estimatedCredits = Number(selectedPrice?.price_credits ?? 0);
  const remainingAfterReserve = balance === null ? null : balance - estimatedCredits;
  // A missing/zero price is not a free offer: keep generation unavailable until the server publishes a verified positive credit price.
  const canGenerate = Boolean(selectedModel && selectedPrice && estimatedCredits > 0 && prompt.trim() && !generating && balance !== null);

  const waitForGenerationJob = async (jobId: string) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const { data, error: jobError } = await supabase.rpc("suly_get_my_media_generation_job", { p_job_id: jobId });
      if (jobError) throw new Error(isArabic ? "تعذر متابعة حالة المهمة. يمكنك متابعة النتيجة من مكتبتي." : "Could not check the job status. You can follow its result in your Library.");
      const job = Array.isArray(data) ? data[0] : data;
      if (!job) {
        setPendingRequest(null);
        throw new Error(isArabic ? "لم يتم العثور على مهمة التوليد." : "The generation job could not be found.");
      }
      if (job.status === "completed") return job as { status: string; output_asset_id: string | null; charged_credits: number; metadata: Record<string, unknown> | null };
      if (job.status === "failed" || job.status === "cancelled") {
        setPendingRequest(null);
        throw new Error(typeof job.error_message === "string" ? job.error_message : (isArabic ? "تعذر إكمال توليد الصورة." : "Image generation could not be completed."));
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return null;
  };

  const generate = async () => {
    if (!canGenerate || !selectedModel || !selectedPrice || !prompt.trim()) return;
    setGenerating(true); setError(null); setNotice(null); setResult(null);
    try {
      const normalizedPrompt = prompt.trim();
      const reusableRequest = pendingRequest?.prompt === normalizedPrompt && pendingRequest.quality === effectiveQuality
        ? pendingRequest
        : null;
      const activeJobs = await listMyGenerationJobs();
      const matchingJob = activeJobs.find((job) =>
        job.serviceType === "image" && job.prompt.trim() === normalizedPrompt && job.quality === effectiveQuality
      );
      const requestId = reusableRequest?.id ?? matchingJob?.id ?? randomUUID();
      setPendingRequest({ prompt: normalizedPrompt, quality: effectiveQuality, id: requestId });
      const { data, error: invokeError } = await supabase.functions.invoke("image-generator", {
        body: {
          source: "image_studio",
          request_id: requestId,
          prompt: prompt.trim(),
          generation_model_id: selectedModel.id,
          quality: effectiveQuality,
        },
      });
      if (invokeError || !data?.success) {
        const status = Number((invokeError as { context?: { status?: number } } | null)?.context?.status ?? 0);
        if (status === 409) setPendingRequest(null);
        const message = typeof data?.error === "string" ? data.error : (isArabic ? "تعذر إنشاء الصورة. حاول مرة أخرى." : "Could not create the image. Please try again.");
        throw new Error(message);
      }
      let mediaId = typeof data.media_id === "string" ? data.media_id : "";
      let chargedCredits = Number(data.charged_credits ?? estimatedCredits);
      let billingStatus = String(data.billing_status ?? "settled");
      const pendingJobId = typeof data.job_id === "string"
        ? data.job_id
        : (data.status === "running" || data.status === "queued") && typeof data.request_id === "string"
          ? data.request_id
          : null;
      if (!mediaId && pendingJobId) {
        setNotice(isArabic ? "تم تسجيل المهمة. ستستمر في الخلفية ويمكنك إغلاق التطبيق ومتابعتها من مكتبتي." : "Your job is queued and will continue in the background. You can close the app and follow it in your Library.");
        const completedJob = await waitForGenerationJob(pendingJobId);
        if (!completedJob) {
          setNotice(isArabic ? "المهمة ما زالت تعمل في الخلفية. يمكنك متابعة حالتها ونتيجتها من مكتبتي." : "The job is still running in the background. Follow its status and result in your Library.");
          return;
        }
        if (!completedJob.output_asset_id) {
          setPendingRequest(null);
          throw new Error(isArabic ? "اكتملت المهمة دون العثور على ملف الصورة." : "The job completed without a resulting image file.");
        }
        mediaId = completedJob.output_asset_id;
        chargedCredits = Number(completedJob.charged_credits ?? estimatedCredits);
        billingStatus = String(completedJob.metadata?.billing_status ?? "settled");
      }
      if (!mediaId) throw new Error(isArabic ? "لم يرجع محرك الصور نتيجة صالحة." : "The image engine did not return a valid result.");
      const url = await getMediaDeliveryUrl(mediaId);
      setResult({ id: mediaId, url, prompt: prompt.trim(), modelName: selectedModel.display_name, quality: effectiveQuality, credits: chargedCredits, billingStatus });
      setPendingRequest(null);
      setNotice(billingStatus === "pending_reconciliation"
        ? (isArabic ? "تم إنشاء الصورة وحفظها. تسوية الرصيد قيد المراجعة؛ لا تعاود إرسال الطلب نفسه." : "Your image was created and saved. Credit reconciliation is under review; do not resubmit the same request.")
        : (isArabic ? "تم إنشاء الصورة وحفظها تلقائيًا في مكتبتك." : "Your image was created and saved to your Library."));
      setBalance(await getCurrentCreditBalance().catch(() => null));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر إكمال توليد الصورة." : "Image generation could not be completed."));
    } finally { setGenerating(false); }
  };

  const copyResultLink = async () => {
    if (!result) return;
    try {
      await Clipboard.setStringAsync(result.url);
      setNotice(isArabic ? "تم نسخ رابط الصورة." : "Image link copied.");
    } catch {
      setError(isArabic ? "تعذر نسخ الرابط. حاول مرة أخرى." : "Could not copy the link. Please try again.");
    }
  };

  const startConversationAboutImage = async () => {
    if (!result || openingChat) return;
    setOpeningChat(true); setError(null);
    try {
      const conversation = await chatService.createConversation(isArabic ? "محادثة حول صورة من استوديو الصور" : "Chat about an image from Image Studio");
      const { data: row, error: assetError } = await supabase.from("global_media_assets")
        .select("id,mime_type,size_bytes,original_filename,created_at,metadata")
        .eq("id", result.id).eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .maybeSingle();
      if (assetError || !row) throw new Error(isArabic ? "تعذر تحميل بيانات الصورة لربطها بالمحادثة." : "Could not load the image details to attach it to the conversation.");
      const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
      const attachment: MediaAsset = {
        id: result.id, featureKey: "chat", url: result.url,
        mimeType: typeof row.mime_type === "string" ? row.mime_type : null,
        sizeBytes: Number(row.size_bytes ?? 0),
        filename: typeof row.original_filename === "string" ? row.original_filename : "SULY generated image",
        kind: "image", createdAt: String(row.created_at ?? new Date().toISOString()),
        width: typeof metadata.width === "number" ? metadata.width : null,
        height: typeof metadata.height === "number" ? metadata.height : null,
        durationSeconds: null, metadata,
      };
      await chatService.sendMessage({
        conversationId: conversation.id,
        content: isArabic ? "حلّل الصورة التي أنشأتها للتو. صف عناصرها وأسلوبها، واذكر اقتراحات عملية لتحسينها أو تطويرها." : "Analyze the image you just created. Describe its elements and style, then suggest practical ways to improve or develop it.",
        modelProfileKey: "auto",
        mediaAsset: attachment,
        signal: new AbortController().signal,
        onUserSaved: () => undefined,
        onChunk: () => undefined,
      });
      router.push("/(protected)/chat");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر بدء محادثة حول الصورة." : "Could not start a conversation about the image."));
    } finally { setOpeningChat(false); }
  };

  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 1000, width: "100%", alignSelf: "center" }} keyboardShouldPersistTaps="handled">
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.primary, textAlign, fontSize: 11, fontWeight: "800" }}>SULY CREATIVE</Text>
      <Text style={{ color: colors.textPrimary, textAlign, fontSize: 25, fontWeight: "900" }}>{isArabic ? "استوديو الصور" : "Image Studio"}</Text>
      <Text style={{ color: colors.textSecondary, textAlign, lineHeight: 21 }}>{isArabic ? "حوّل وصفك إلى صورة. اختر نموذج SULY وجودة النتيجة قبل بدء التنفيذ." : "Turn your description into an image. Choose a SULY model and output quality before starting."}</Text>
    </View>

    {error ? <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.error, backgroundColor: colors.surface }}>
      <Text accessibilityRole="alert" style={{ color: colors.error, textAlign }}>{error}</Text>
      <Pressable disabled={loading} onPress={() => void load()} accessibilityRole="button" style={{ alignSelf: "flex-start", minHeight: 42, justifyContent: "center", paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primary, opacity: loading ? 0.5 : 1 }}>
        <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>{loading ? (isArabic ? "جارٍ إعادة المحاولة…" : "Retrying…") : (isArabic ? "إعادة المحاولة" : "Try again")}</Text>
      </Pressable>
    </View> : null}
    {notice ? <Text style={{ color: colors.success, textAlign }}>{notice}</Text> : null}

    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 14, gap: 10 }}>
      <Text style={{ color: colors.textPrimary, textAlign, fontWeight: "800" }}>{isArabic ? "١. اختر نموذج الصور" : "1. Choose an image model"}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : models.length === 0 ? <Text style={{ color: colors.textMuted, textAlign }}>{isArabic ? "لا يوجد نموذج صور متاح حاليًا لاشتراكك. سيظهر النموذج هنا بعد ربطه وتفعيله من لوحة الإدارة." : "No image model is currently available for your plan. A model will appear here after it is connected and enabled in the admin panel."}</Text> : models.map((model) => <Pressable key={model.id} accessibilityRole="button" accessibilityState={{ selected: selectedModelId === model.id }} onPress={() => setSelectedModelId(model.id)} style={{ borderWidth: 1, borderColor: selectedModelId === model.id ? colors.primary : colors.divider, backgroundColor: selectedModelId === model.id ? colors.surfaceElevated : colors.cardBackground, borderRadius: 12, padding: 12, gap: 3 }}>
        <Text style={{ color: selectedModelId === model.id ? colors.primary : colors.textPrimary, textAlign, fontWeight: "800" }}>{model.display_name} {model.is_default ? (isArabic ? "· موصى به" : "· Recommended") : ""}</Text>
        <Text style={{ color: colors.textMuted, textAlign, fontSize: 10 }}>{isArabic ? "نموذج SULY للصور" : "SULY image model"}</Text>
      </Pressable>)}

      <Text style={{ color: colors.textPrimary, textAlign, fontWeight: "800" }}>{isArabic ? "٢. جودة الصورة" : "2. Image quality"}</Text>
      <View style={{ flexDirection: rowDirection, flexWrap: "wrap", gap: 7 }}>
        {availableQualities.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: effectiveQuality === item }} onPress={() => setQuality(item)} style={{ borderWidth: 1, borderColor: effectiveQuality === item ? colors.primary : colors.divider, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: effectiveQuality === item ? colors.surfaceElevated : colors.surface }}>
          <Text style={{ color: effectiveQuality === item ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: "700" }}>{qualityLabel(item)}</Text>
        </Pressable>)}
      </View>

      <Text style={{ color: colors.textPrimary, textAlign, fontWeight: "800" }}>{isArabic ? "٣. وصف الصورة" : "3. Describe your image"}</Text>
      <TextInput accessibilityLabel={isArabic ? "وصف الصورة" : "Image description"} value={prompt} onChangeText={setPrompt} placeholder={isArabic ? "اكتب وصفًا واضحًا للصورة التي تريد إنشاءها..." : "Describe the image you want to create clearly…"} placeholderTextColor={colors.textMuted} multiline maxLength={2048} textAlignVertical="top" style={{ minHeight: 125, color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 12, padding: 12, textAlign }} />
      <Text style={{ color: colors.textMuted, textAlign, fontSize: 10, lineHeight: 17 }}>{isArabic ? "كلما كان وصفك أدق في تحديد العناصر والألوان والأسلوب والتكوين، ساعد ذلك على الوصول إلى نتيجة أفضل." : "A more precise description of the objects, colors, style, and composition can help produce a better result."}</Text>

      <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10, gap: 6 }}>
        <View style={{ flexDirection: rowDirection, justifyContent: "space-between" }}><Text style={{ color: colors.textSecondary }}>{isArabic ? "السعر التقديري" : "Estimated cost"}</Text><Text style={{ color: colors.primary, fontWeight: "900" }}>{estimatedCredits.toLocaleString(locale)} Credits</Text></View>
        <View style={{ flexDirection: rowDirection, justifyContent: "space-between" }}><Text style={{ color: colors.textSecondary }}>{isArabic ? "رصيدك الحالي" : "Current balance"}</Text><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{balance === null ? "—" : balance.toLocaleString(locale)}</Text></View>
        <View style={{ flexDirection: rowDirection, justifyContent: "space-between" }}><Text style={{ color: colors.textSecondary }}>{isArabic ? "الرصيد بعد الحجز" : "Balance after reservation"}</Text><Text style={{ color: remainingAfterReserve !== null && remainingAfterReserve < 0 ? colors.error : colors.textPrimary, fontWeight: "700" }}>{remainingAfterReserve === null ? "—" : remainingAfterReserve.toLocaleString(locale)}</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canGenerate }} disabled={!canGenerate} onPress={() => void generate()} style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, opacity: canGenerate ? 1 : 0.45, alignItems: "center" }}>
        <Text style={{ color: colors.onPrimary, fontWeight: "900" }}>{generating ? (isArabic ? "جاري تجهيز طلبك…" : "Preparing your request…") : result ? (isArabic ? "إعادة توليد الصورة" : "Generate again") : (isArabic ? "تأكيد وإنشاء الصورة" : "Confirm and generate")}</Text>
      </Pressable>
      <Text style={{ color: colors.textMuted, textAlign, fontSize: 10, lineHeight: 17 }}>{isArabic ? "قد يسمح النظام ببدء المهمة ضمن حد الرصيد السالب الذي يحدده المشرف. سيتم التحقق من الحد الفعلي عند تأكيد الطلب." : "The system may allow a task within the negative-credit limit configured by an administrator. The actual limit is checked when you confirm."}</Text>
    </View>

    {generating ? <Animated.View style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 12, transform: [{ scale: breathingScale }] }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900" }}>{isArabic ? "جاري التوليد" : "Generating"}</Text>
      <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: 11 }}>{isArabic ? "نموذج SULY يعمل على إنشاء صورتك. اترك المهمة تكمل." : "SULY is creating your image. Let the task finish."}</Text>
    </Animated.View> : null}

    {result ? <Animated.View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 12, gap: 10, opacity: resultOpacity }}>
      <Text style={{ color: colors.textPrimary, textAlign, fontWeight: "900" }}>{isArabic ? "الصورة الناتجة" : "Generated image"}</Text>
      <Image source={{ uri: result.url }} resizeMode="contain" style={{ width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: colors.surfaceElevated }} />
      <Text style={{ color: colors.textSecondary, textAlign: "right", fontSize: 10 }}>{result.modelName} · {qualityLabel(result.quality)} · {result.credits} Credits</Text>
      {result.billingStatus === "pending_reconciliation" ? <Text style={{ color: colors.warning, textAlign, fontSize: 10 }}>{isArabic ? "تسوية الرصيد قيد المراجعة" : "Credit reconciliation is under review"}</Text> : null}
      <View style={{ flexDirection: rowDirection, flexWrap: "wrap", gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "فتح أو تنزيل الصورة" : "Open or download image"} onPress={() => void Linking.openURL(result.url)} style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: 9, padding: 10 }}><Text style={{ color: colors.textPrimary, fontSize: 11 }}>{isArabic ? "فتح / تنزيل الصورة" : "Open / download image"}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "نسخ رابط الصورة" : "Copy image link"} onPress={() => void copyResultLink()} style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: 9, padding: 10 }}><Text style={{ color: colors.textPrimary, fontSize: 11 }}>{isArabic ? "نسخ رابط الصورة" : "Copy image link"}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "فتح مكتبتي" : "Open Library"} onPress={() => router.push("/(protected)/media")} style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: 9, padding: 10 }}><Text style={{ color: colors.textPrimary, fontSize: 11 }}>{isArabic ? "فتح مكتبتي" : "Open Library"}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "ابدأ محادثة حول الصورة" : "Start a chat about this image"} disabled={openingChat} onPress={() => void startConversationAboutImage()} style={{ backgroundColor: colors.primary, borderRadius: 9, padding: 10, opacity: openingChat ? 0.55 : 1 }}><Text style={{ color: colors.onPrimary, fontSize: 11, fontWeight: "800" }}>{openingChat ? (isArabic ? "جارٍ بدء المحادثة…" : "Starting chat…") : (isArabic ? "ابدأ محادثة عنها" : "Start a chat about it")}</Text></Pressable>
      </View>
    </Animated.View> : null}
  </ScrollView>;
}
