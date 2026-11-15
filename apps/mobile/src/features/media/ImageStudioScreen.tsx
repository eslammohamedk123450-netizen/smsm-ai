import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, Linking, Pressable, ScrollView, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { randomUUID } from "expo-crypto";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { colors } from "../../theme/colors";
import { supabase } from "../../lib/supabase/client";
import { getCurrentCreditBalance } from "../credits/credit-service";
import { getMediaDeliveryUrl, type MediaAsset } from "../media/media-service";
import { chatService } from "../chat/chat-service";

type Price = { quality: string; price_credits: number; resolution: string };
type Model = { id: string; display_name: string; supported_qualities: string[]; is_default: boolean; prices: Price[] };
type GeneratedImage = { id: string; url: string; prompt: string; modelName: string; quality: string; credits: number };
const QUALITY_LABELS: Record<string, string> = { economy: "اقتصادية", standard: "متوسطة", high: "عالية", ultra: "فائقة" };

export function ImageStudioScreen() {
  const router = useRouter();
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
    setLoading(true); setError(null);
    const [modelResult, balanceResult] = await Promise.all([
      supabase.rpc("suly_list_public_image_models"),
      getCurrentCreditBalance().catch(() => null),
    ]);
    if (modelResult.error) setError("تعذر تحميل إعدادات استوديو الصور.");
    else {
      const allowed = (modelResult.data ?? []) as Model[];
      setModels(allowed);
      setSelectedModelId((current) => current && allowed.some((model) => model.id === current) ? current : allowed[0]?.id ?? null);
      setBalance(typeof balanceResult === "number" ? balanceResult : null);
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selectedModel = models.find((model) => model.id === selectedModelId) ?? null;
  const availableQualities = selectedModel?.prices.map((price) => price.quality)
    .filter((item) => selectedModel.supported_qualities.includes(item)) ?? [];
  const effectiveQuality = availableQualities.includes(quality) ? quality : availableQualities[0] ?? "standard";
  const selectedPrice = selectedModel?.prices.find((price) => price.quality === effectiveQuality) ?? null;
  const estimatedCredits = Number(selectedPrice?.price_credits ?? 0);
  const remainingAfterReserve = balance === null ? null : balance - estimatedCredits;
  const canGenerate = Boolean(selectedModel && selectedPrice && prompt.trim() && !generating && balance !== null && balance >= estimatedCredits);

  const generate = async () => {
    if (!selectedModel || !selectedPrice || !prompt.trim()) return;
    setGenerating(true); setError(null); setNotice(null); setResult(null);
    const requestId = randomUUID();
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("image-generator", {
        body: {
          source: "image_studio",
          request_id: requestId,
          prompt: prompt.trim(),
          generation_model_id: selectedModel.id,
          quality: effectiveQuality,
        },
      });
      if (invokeError || !data?.success || typeof data.media_id !== "string") {
        const message = typeof data?.error === "string" ? data.error : "تعذر إنشاء الصورة. حاول مرة أخرى.";
        throw new Error(message);
      }
      const url = await getMediaDeliveryUrl(data.media_id);
      setResult({ id: data.media_id, url, prompt: prompt.trim(), modelName: selectedModel.display_name, quality: effectiveQuality, credits: Number(data.charged_credits ?? estimatedCredits) });
      setNotice("تم إنشاء الصورة وحفظها تلقائيًا في مكتبتك.");
      setBalance(await getCurrentCreditBalance().catch(() => null));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إكمال توليد الصورة.");
    } finally { setGenerating(false); }
  };

  const copyResultLink = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.url);
    setNotice("تم نسخ رابط الصورة.");
  };

  const startConversationAboutImage = async () => {
    if (!result || openingChat) return;
    setOpeningChat(true); setError(null);
    try {
      const conversation = await chatService.createConversation("محادثة حول صورة من استوديو الصور");
      const { data: row, error: assetError } = await supabase.from("global_media_assets")
        .select("id,mime_type,size_bytes,original_filename,created_at,metadata")
        .eq("id", result.id).eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .maybeSingle();
      if (assetError || !row) throw new Error("تعذر تحميل بيانات الصورة لربطها بالمحادثة.");
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
        content: "حلّل الصورة التي أنشأتها للتو. صف عناصرها وأسلوبها، واذكر اقتراحات عملية لتحسينها أو تطويرها.",
        modelProfileKey: "auto",
        mediaAsset: attachment,
        signal: new AbortController().signal,
        onUserSaved: () => undefined,
        onChunk: () => undefined,
      });
      router.push("/(protected)/chat");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر بدء محادثة حول الصورة.");
    } finally { setOpeningChat(false); }
  };

  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 1000, width: "100%", alignSelf: "center" }} keyboardShouldPersistTaps="handled">
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.primary, textAlign: "right", fontSize: 11, fontWeight: "800" }}>SULY CREATIVE</Text>
      <Text style={{ color: colors.textPrimary, textAlign: "right", fontSize: 25, fontWeight: "900" }}>استوديو الصور</Text>
      <Text style={{ color: colors.textSecondary, textAlign: "right", lineHeight: 21 }}>حوّل وصفك إلى صورة. اختر نموذج SULY وجودة النتيجة قبل بدء التنفيذ.</Text>
    </View>

    {error ? <Text style={{ color: colors.error, textAlign: "right" }}>{error}</Text> : null}
    {notice ? <Text style={{ color: colors.success, textAlign: "right" }}>{notice}</Text> : null}

    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 14, gap: 10 }}>
      <Text style={{ color: colors.textPrimary, textAlign: "right", fontWeight: "800" }}>١. اختر نموذج الصور</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : models.length === 0 ? <Text style={{ color: colors.textMuted, textAlign: "right" }}>لا يوجد نموذج صور متاح حاليًا لاشتراكك. سيظهر النموذج هنا بعد ربطه وتفعيله من لوحة الإدارة.</Text> : models.map((model) => <Pressable key={model.id} onPress={() => setSelectedModelId(model.id)} style={{ borderWidth: 1, borderColor: selectedModelId === model.id ? colors.primary : colors.divider, backgroundColor: selectedModelId === model.id ? colors.surfaceElevated : colors.cardBackground, borderRadius: 12, padding: 12, gap: 3 }}>
        <Text style={{ color: selectedModelId === model.id ? colors.primary : colors.textPrimary, textAlign: "right", fontWeight: "800" }}>{model.display_name} {model.is_default ? "· موصى به" : ""}</Text>
        <Text style={{ color: colors.textMuted, textAlign: "right", fontSize: 10 }}>نموذج SULY للصور</Text>
      </Pressable>)}

      <Text style={{ color: colors.textPrimary, textAlign: "right", fontWeight: "800" }}>٢. جودة الصورة</Text>
      <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }}>
        {availableQualities.map((item) => <Pressable key={item} onPress={() => setQuality(item)} style={{ borderWidth: 1, borderColor: effectiveQuality === item ? colors.primary : colors.divider, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: effectiveQuality === item ? colors.surfaceElevated : colors.surface }}>
          <Text style={{ color: effectiveQuality === item ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: "700" }}>{QUALITY_LABELS[item] ?? item}</Text>
        </Pressable>)}
      </View>

      <Text style={{ color: colors.textPrimary, textAlign: "right", fontWeight: "800" }}>٣. وصف الصورة</Text>
      <TextInput value={prompt} onChangeText={setPrompt} placeholder="اكتب وصفًا واضحًا للصورة التي تريد إنشاءها..." placeholderTextColor={colors.textMuted} multiline maxLength={2048} textAlignVertical="top" style={{ minHeight: 125, color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 12, padding: 12, textAlign: "right" }} />
      <Text style={{ color: colors.textMuted, textAlign: "right", fontSize: 10, lineHeight: 17 }}>كلما كان وصفك أدق في تحديد العناصر والألوان والأسلوب والتكوين، ساعد ذلك على الوصول إلى نتيجة أفضل.</Text>

      <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10, gap: 6 }}>
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}><Text style={{ color: colors.textSecondary }}>السعر التقديري</Text><Text style={{ color: colors.primary, fontWeight: "900" }}>{estimatedCredits.toLocaleString("ar-EG")} Credits</Text></View>
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}><Text style={{ color: colors.textSecondary }}>رصيدك الحالي</Text><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{balance === null ? "—" : balance.toLocaleString("ar-EG")}</Text></View>
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}><Text style={{ color: colors.textSecondary }}>الرصيد بعد الحجز</Text><Text style={{ color: remainingAfterReserve !== null && remainingAfterReserve < 0 ? colors.error : colors.textPrimary, fontWeight: "700" }}>{remainingAfterReserve === null ? "—" : remainingAfterReserve.toLocaleString("ar-EG")}</Text></View>
      </View>
      <Pressable disabled={!canGenerate} onPress={() => void generate()} style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, opacity: canGenerate ? 1 : 0.45, alignItems: "center" }}>
        <Text style={{ color: colors.background, fontWeight: "900" }}>{generating ? "جاري تجهيز طلبك…" : result ? "إعادة توليد الصورة" : "تأكيد وإنشاء الصورة"}</Text>
      </Pressable>
      {balance !== null && selectedPrice && balance < estimatedCredits ? <Text style={{ color: colors.error, textAlign: "right", fontSize: 11 }}>رصيدك غير كافٍ لهذا الطلب. اشحن رصيدك للمتابعة.</Text> : null}
    </View>

    {generating ? <Animated.View style={{ backgroundColor: "#17150D", borderColor: "#D4AF37", borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 12, transform: [{ scale: breathingScale }] }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900" }}>جاري التوليد</Text>
      <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: 11 }}>نموذج SULY يعمل على إنشاء صورتك. اترك المهمة تكمل.</Text>
    </Animated.View> : null}

    {result ? <Animated.View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 12, gap: 10, opacity: resultOpacity }}>
      <Text style={{ color: colors.textPrimary, textAlign: "right", fontWeight: "900" }}>الصورة الناتجة</Text>
      <Image source={{ uri: result.url }} resizeMode="contain" style={{ width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: colors.surfaceElevated }} />
      <Text style={{ color: colors.textSecondary, textAlign: "right", fontSize: 10 }}>{result.modelName} · {QUALITY_LABELS[result.quality]} · {result.credits} Credits</Text>
      <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
        <Pressable onPress={() => void Linking.openURL(result.url)} style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: 9, padding: 10 }}><Text style={{ color: colors.textPrimary, fontSize: 11 }}>فتح / تنزيل الصورة</Text></Pressable>
        <Pressable onPress={() => void copyResultLink()} style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: 9, padding: 10 }}><Text style={{ color: colors.textPrimary, fontSize: 11 }}>نسخ رابط الصورة</Text></Pressable>
        <Pressable onPress={() => router.push("/(protected)/media")} style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: 9, padding: 10 }}><Text style={{ color: colors.textPrimary, fontSize: 11 }}>فتح مكتبتي</Text></Pressable>
        <Pressable disabled={openingChat} onPress={() => void startConversationAboutImage()} style={{ backgroundColor: colors.primary, borderRadius: 9, padding: 10, opacity: openingChat ? 0.55 : 1 }}><Text style={{ color: colors.background, fontSize: 11, fontWeight: "800" }}>{openingChat ? "جارٍ بدء المحادثة…" : "ابدأ محادثة عنها"}</Text></Pressable>
      </View>
    </Animated.View> : null}
  </ScrollView>;
}
