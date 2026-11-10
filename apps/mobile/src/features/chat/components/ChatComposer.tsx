import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ElementRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { Ionicons } from "@expo/vector-icons";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useToast } from "../../../components/ui/Toast";
import { AttachSheet } from "./AttachSheet";
import type { PickedMedia } from "../../media/media-service";

export type ChatAttachment = PickedMedia;
export interface ChatComposerHandle {
  editMessage(content: string): void;
}
export interface ChatComposerProps {
  onSend(content: string, attachment?: ChatAttachment): void;
  disabled?: boolean;
  isStreaming?: boolean;
  onCancel?(): void;
  creditBalance?: number | null;
  onOpenRecharge?(): void;
}

function formatDictationDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  {
    onSend,
    disabled = false,
    isStreaming = false,
    onCancel,
    creditBalance = null,
    onOpenRecharge,
  },
  ref
) {
  const [text, setText] = useState("");
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachmentPreviewUri, setAttachmentPreviewUri] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [speechDetected, setSpeechDetected] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [attachVisible, setAttachVisible] = useState(false);
  const speechBase = useRef("");
  const recordingPulse = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<ElementRef<typeof TextInput>>(null);
  const voiceIntent = useRef(false);
  const ignoreRecognitionResults = useRef(false);
  const timerStartedAt = useRef(0);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechWaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartDelay = useRef(250);
  const startRecognitionRef = useRef<() => void>(() => {});
  const scheduleRestartRef = useRef<() => void>(() => {});
  const waveBars = useRef<Animated.Value[]>([]);
  if (waveBars.current.length === 0) waveBars.current = Array.from({ length: 5 }, () => new Animated.Value(0));
  const { show } = useToast();
  const voiceSupported = Platform.OS !== "web" || ExpoSpeechRecognitionModule.isRecognitionAvailable();

  const clearRestart = () => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = null;
  };

  const clearSpeechWaveTimer = () => {
    if (speechWaveTimer.current) clearTimeout(speechWaveTimer.current);
    speechWaveTimer.current = null;
  };

  useImperativeHandle(ref, () => ({
    editMessage(content: string) {
      setText(content);
      setAttachment(null);
      speechBase.current = "";
      setSelection({ start: content.length, end: content.length });
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  }), []);

  startRecognitionRef.current = () => {
    if (!voiceIntent.current) return;
    try {
      ExpoSpeechRecognitionModule.start({
        lang: "ar-EG",
        continuous: true,
        interimResults: true,
        maxAlternatives: 1,
      });
    } catch {
      voiceIntent.current = false;
      setVoiceActive(false);
      setVoiceListening(false);
      clearRestart();
      show("التعرّف الصوتي غير متاح على هذا الجهاز.", "error");
    }
  };

  scheduleRestartRef.current = () => {
    if (!voiceIntent.current || restartTimer.current) return;
    const delay = restartDelay.current;
    restartDelay.current = Math.min(restartDelay.current * 2, 4000);
    restartTimer.current = setTimeout(() => {
      restartTimer.current = null;
      if (voiceIntent.current) startRecognitionRef.current();
    }, delay);
  };

  useSpeechRecognitionEvent("start", () => {
    clearRestart();
    restartDelay.current = 250;
    if (voiceIntent.current) setVoiceListening(true);
  });
  useSpeechRecognitionEvent("end", () => {
    setVoiceListening(false);
    setSpeechDetected(false);
    clearSpeechWaveTimer();
    if (voiceIntent.current) scheduleRestartRef.current();
  });
  useSpeechRecognitionEvent("error", (event) => {
    setVoiceListening(false);
    setSpeechDetected(false);
    clearSpeechWaveTimer();
    if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
      voiceIntent.current = false;
      clearRestart();
      setVoiceActive(false);
      show(event.message || "تعذّر الوصول إلى الميكروفون. تحقق من الأذونات وحاول مجددًا.", "error");
      return;
    }
    if (voiceIntent.current) scheduleRestartRef.current();
  });
  useSpeechRecognitionEvent("result", (event) => {
    if (ignoreRecognitionResults.current) return;
    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    setSpeechDetected(true);
    clearSpeechWaveTimer();
    speechWaveTimer.current = setTimeout(() => {
      speechWaveTimer.current = null;
      setSpeechDetected(false);
    }, 650);
    const next = [speechBase.current, transcript].filter(Boolean).join(" ");
    setText(next);
    if (event.isFinal) speechBase.current = next;
  });

  useEffect(() => {
    if (!voiceActive) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - timerStartedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [voiceActive]);

  useEffect(() => {
    if (!voiceActive) {
      recordingPulse.setValue(0);
      return;
    }
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(recordingPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(recordingPulse, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [recordingPulse, voiceActive]);

  useEffect(() => {
    if (!voiceActive || !speechDetected) {
      waveBars.current.forEach((value) => {
        value.stopAnimation();
        value.setValue(0);
      });
      return;
    }
    const animations = waveBars.current.map((value, index) => Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 170 + index * 37, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: 210 + (4 - index) * 29, useNativeDriver: true }),
    ])));
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [speechDetected, voiceActive]);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (attachment?.kind === "image") {
      if (attachment.part.uri) setAttachmentPreviewUri(attachment.part.uri);
      else if (Platform.OS === "web" && attachment.part.blob && typeof URL !== "undefined") {
        objectUrl = URL.createObjectURL(attachment.part.blob);
        setAttachmentPreviewUri(objectUrl);
      } else setAttachmentPreviewUri(null);
    } else setAttachmentPreviewUri(null);
    setPreviewVisible(false);
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment]);

  useEffect(() => () => {
    voiceIntent.current = false;
    clearRestart();
    clearSpeechWaveTimer();
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* Ignore */ }
  }, []);

  const stopVoice = () => {
    voiceIntent.current = false;
    clearRestart();
    clearSpeechWaveTimer();
    setVoiceActive(false);
    setVoiceListening(false);
    setSpeechDetected(false);
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* Ignore */ }
  };

  const submit = () => {
    const content = text.trim();
    if ((!content && !attachment) || disabled) return;
    if (voiceActive) stopVoice();
    ignoreRecognitionResults.current = true;
    onSend(content, attachment ?? undefined);
    setText(""); setSelection(undefined); setAttachment(null); speechBase.current = "";
  };

  const beginVoice = () => {
    ignoreRecognitionResults.current = false;
    speechBase.current = text.trim();
    voiceIntent.current = true;
    timerStartedAt.current = Date.now();
    setElapsedSeconds(0);
    setSpeechDetected(false);
    setVoiceActive(true);
    startRecognitionRef.current();
  };

  const requestVoicePermission = async () => {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        show("لم يُمنح إذن الميكروفون.", "info");
        return;
      }
      beginVoice();
    } catch {
      show("تعذّر طلب إذن الميكروفون على هذا الجهاز.", "error");
    }
  };

  const hasLowBalance = creditBalance !== null && creditBalance < 500;

  return (
    <View style={styles.wrapper}>
      {/* Low Balance Warning Banner */}
      {hasLowBalance && (
        <View style={styles.lowBalanceBanner}>
          <View style={styles.bannerTextRow}>
            <Ionicons name="alert-circle" size={16} color="#F87171" />
            <Text style={styles.bannerText}>
              رصيدك أوشك على النفاد (المتبقي: {creditBalance?.toLocaleString("en-US")} نقطة)
            </Text>
          </View>
          <TouchableOpacity onPress={onOpenRecharge} style={styles.bannerRechargeBtn} activeOpacity={0.8}>
            <Text style={styles.bannerRechargeText}>اشحن الآن</Text>
          </TouchableOpacity>
        </View>
      )}

      {attachment ? attachment.kind === "image" && attachmentPreviewUri ? (
        <View style={styles.imageAttachmentPreview}>
          <Pressable onPress={() => setPreviewVisible(true)} accessibilityRole="button" accessibilityLabel="عرض معاينة الصورة">
            <Image source={{ uri: attachmentPreviewUri }} style={styles.attachmentThumbnail} resizeMode="cover" />
          </Pressable>
          <View style={styles.attachmentInfo}>
            <Text numberOfLines={1} style={styles.attachmentText}>{attachment.part.name}</Text>
            <Text style={styles.attachmentHint}>اضغط على الصورة للتكبير</Text>
          </View>
          <Pressable onPress={() => setAttachment(null)} accessibilityRole="button" accessibilityLabel="إزالة المرفق" style={styles.removeAttachmentButton}>
            <Ionicons name="close" size={18} color="#A1A1AA" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.attachmentChip}>
          <Text numberOfLines={1} style={styles.attachmentText}>مرفق: {attachment.part.name}</Text>
          <Pressable onPress={() => setAttachment(null)} accessibilityRole="button" accessibilityLabel="إزالة المرفق">
            <Text style={styles.removeAttachment}>×</Text>
          </Pressable>
        </View>
      ) : null}

      {voiceActive ? (
        <View style={styles.voiceToolbar}>
          <View style={styles.voiceStatus} accessibilityLiveRegion="polite">
            <View style={styles.voiceWaveform} accessibilityLabel="موجات الصوت">
              {waveBars.current.map((bar, index) => (
                <Animated.View
                  key={index}
                  style={[styles.voiceWaveBar, { transform: [{ scaleY: bar.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]}
                />
              ))}
            </View>
            <Text style={styles.voiceTimer}>{formatDictationDuration(elapsedSeconds)}</Text>
            {!voiceListening ? <Text style={styles.reconnecting}>جارٍ إعادة الاتصال…</Text> : null}
          </View>
          <Pressable onPress={stopVoice} style={styles.cancelVoiceButton}>
            <Text style={styles.cancelVoiceText}>×</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Main Bar: Height 56, #1F1F1F, r: 999 */}
      <View style={styles.container}>
        {/* Right side (RTL start): + Button */}
        <TouchableOpacity
          onPress={() => setAttachVisible(true)}
          disabled={disabled || isStreaming}
          activeOpacity={0.7}
          style={styles.plusButton}
          accessibilityLabel="إضافة ملف"
        >
          <Ionicons name="add" size={22} color="#A1A1AA" />
        </TouchableOpacity>

        {/* Center: TextInput with placeholder "اسأل Suly" */}
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          selection={selection}
          onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
          editable={!disabled && !isStreaming}
          placeholder="اسأل Suly"
          placeholderTextColor="#A1A1AA"
          style={styles.input}
          multiline={false}
          maxLength={16000}
          textAlign="right"
          accessibilityLabel="اسأل Suly"
        />

        {/* Left side (RTL end): Mic icon + Blue circular button with sound waves */}
        <View style={styles.leftControls}>
          <TouchableOpacity
            onPress={() => (voiceActive ? stopVoice() : void requestVoicePermission())}
            disabled={disabled || isStreaming || !voiceSupported}
            activeOpacity={0.7}
            style={styles.micButton}
            accessibilityLabel="تسجيل صوتي"
          >
            <Ionicons name={voiceActive ? "mic" : "mic-outline"} size={20} color={voiceActive ? "#F87171" : "#A1A1AA"} />
            {voiceActive ? <Animated.View style={styles.recordingPulse} /> : null}
          </TouchableOpacity>

          {isStreaming ? (
            <Pressable style={styles.blueButton} onPress={onCancel} accessibilityLabel="إيقاف الرد">
              <ActivityIndicator size="small" color="#FFFFFF" />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.blueButton, (!text.trim() && !attachment && !voiceActive) && styles.blueButtonIdle]}
              onPress={submit}
              disabled={disabled || (!text.trim() && !attachment)}
              accessibilityLabel="إرسال"
            >
              {text.trim() || attachment ? (
                <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
              ) : (
                <Ionicons name="radio-outline" size={18} color="#FFFFFF" />
              )}
            </Pressable>
          )}
        </View>
      </View>

      <AttachSheet visible={attachVisible} onClose={() => setAttachVisible(false)} onPicked={setAttachment} />
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <Pressable style={styles.previewOverlay} onPress={() => setPreviewVisible(false)} accessibilityRole="button" accessibilityLabel="إغلاق معاينة الصورة">
          <Pressable style={styles.previewClose} onPress={() => setPreviewVisible(false)} accessibilityRole="button" accessibilityLabel="إغلاق">
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          {attachmentPreviewUri ? <Image source={{ uri: attachmentPreviewUri }} style={styles.previewImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: "#000000",
  },
  lowBalanceBanner: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 8,
  },
  bannerTextRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, flex: 1 },
  bannerText: { color: "#F5F5F5", fontSize: 13, fontWeight: "400", textAlign: "right" },
  bannerRechargeBtn: { backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  bannerRechargeText: { color: "#000000", fontSize: 11, fontWeight: "700" },
  container: {
    height: 56,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "#1F1F1F",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  plusButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  input: {
    flex: 1,
    height: 48,
    color: "#F5F5F5",
    fontSize: 15,
    paddingHorizontal: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  leftControls: { flexDirection: "row", alignItems: "center", gap: 4 },
  micButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  recordingPulse: { position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: "#F87171" },
  blueButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },
  blueButtonIdle: { backgroundColor: "#2563EB", opacity: 0.9 },
  attachmentChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#262626",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 6,
  },
  imageAttachmentPreview: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 10, maxWidth: "100%", marginBottom: 8, padding: 6, borderRadius: 14, borderWidth: 1, borderColor: "#262626", backgroundColor: "#111111" },
  attachmentThumbnail: { width: 66, height: 66, borderRadius: 9, backgroundColor: "#1F1F1F" },
  attachmentInfo: { flex: 1, minWidth: 0 },
  attachmentHint: { color: "#A1A1AA", fontSize: 11, marginTop: 4 },
  removeAttachmentButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#1F1F1F" },
  attachmentText: { color: "#F5F5F5", fontSize: 12 },
  removeAttachment: { color: "#A1A1AA", fontSize: 18 },
  previewOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.94)", justifyContent: "center", alignItems: "center" },
  previewImage: { width: "100%", height: "85%" },
  previewClose: { position: "absolute", top: 44, right: 20, zIndex: 1, width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(45, 45, 45, 0.9)" },
  voiceToolbar: {
    minHeight: 46,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "#111111",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
  },
  voiceStatus: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  voiceWaveform: { height: 24, flexDirection: "row", alignItems: "center", gap: 3, marginHorizontal: 2 },
  voiceWaveBar: { width: 3, height: 18, borderRadius: 2, backgroundColor: "#0EA5E9" },
  voiceTimer: { color: "#F5F5F5", fontSize: 14, fontWeight: "700" },
  reconnecting: { color: "#A1A1AA", fontSize: 12 },
  cancelVoiceButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#262626", borderRadius: 16 },
  cancelVoiceText: { color: "#F87171", fontSize: 20 },
});
