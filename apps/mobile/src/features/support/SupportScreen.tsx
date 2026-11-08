import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { colors } from "../../theme/colors";
import { logFrictionEvent } from "../telemetry/friction";
import { pickMedia, uploadMediaFile, type PickedMedia } from "../media/media-service";
import { supportService, type SupportAttachment, type SupportReply, type SupportTicket, type TicketCategory } from "./support-service";

const categories: { key: TicketCategory; label: string }[] = [
  { key: "bug", label: "مشكلة تقنية" }, { key: "account", label: "الحساب" },
  { key: "billing", label: "الرصيد والدفع" }, { key: "content", label: "المحتوى" }, { key: "other", label: "أخرى" },
];
const statusLabel: Record<string, string> = { new: "جديد", in_progress: "قيد المعالجة", waiting_user: "بانتظارك", resolved: "تم الحل", closed: "مغلق" };

export function SupportScreen() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>("bug");
  const [picked, setPicked] = useState<PickedMedia | null>(null);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [replyText, setReplyText] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setTickets(await supportService.listMyTickets()); }
    catch (cause) { Alert.alert("الدعم", cause instanceof Error ? cause.message : "تعذر تحميل الطلبات."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const chooseImage = async () => {
    try { setPicked(await pickMedia("image")); }
    catch (cause) { Alert.alert("تعذر اختيار الصورة", cause instanceof Error ? cause.message : "حاول مرة أخرى."); }
  };

  const submit = async () => {
    if (subject.trim().length < 3 || description.trim().length < 3) {
      Alert.alert("أكمل بيانات الطلب", "اكتب عنوانًا ووصفًا لا يقل كل منهما عن 3 أحرف."); return;
    }
    setSending(true);
    try {
      const ticket = await supportService.createTicket({ subject, category, description });
      let attachmentFailed = false;
      if (picked) {
        try { await uploadMediaFile({ picked, featureKey: "support", supportTicketId: ticket.id }); }
        catch (cause) {
          attachmentFailed = true;
          void logFrictionEvent({ eventKind: "upload_failed", screenKey: "support", featureKey: "support", stepKey: "ticket_attachment", errorCode: cause instanceof Error ? cause.name.toLowerCase() : "unknown" });
        }
      }
      setSubject(""); setDescription(""); setPicked(null);
      await refresh();
      Alert.alert(attachmentFailed ? "تم إرسال الطلب دون الصورة" : "تم إرسال طلب الدعم", attachmentFailed ? "حُفظ وصف المشكلة، لكن تعذر رفع الصورة. يمكنك إرسالها بردّ لاحقًا." : "سيظهر الطلب في صندوق دعم المشرف.");
    } catch (cause) {
      void logFrictionEvent({ eventKind: "action_failed", screenKey: "support", featureKey: "support", stepKey: "ticket_submit", errorCode: "ticket_submit_failed" });
      Alert.alert("تعذر إرسال الطلب", cause instanceof Error ? cause.message : "حاول مرة أخرى.");
    } finally { setSending(false); }
  };

  const openTicket = async (ticket: SupportTicket) => {
    setSelected(ticket); setDetailLoading(true); setReplies([]); setAttachments([]);
    try {
      const [nextReplies, nextAttachments] = await Promise.all([supportService.listReplies(ticket.id), supportService.attachments(ticket.id)]);
      setReplies(nextReplies); setAttachments(nextAttachments);
    } catch (cause) { Alert.alert("تعذر تحميل الطلب", cause instanceof Error ? cause.message : "حاول مرة أخرى."); }
    finally { setDetailLoading(false); }
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    try {
      await supportService.reply(selected.id, replyText);
      setReplyText("");
      setReplies(await supportService.listReplies(selected.id));
      await refresh();
    } catch (cause) { Alert.alert("تعذر إرسال الرد", cause instanceof Error ? cause.message : "حاول مرة أخرى."); }
  };

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}><ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Text style={styles.title}>الدعم والشكاوى</Text><Pressable onPress={() => void refresh()}><Text style={styles.link}>تحديث</Text></Pressable></View>
    <Text style={styles.subtitle}>اكتب وصف المشكلة، وأرفق صورة توضيحية إن احتجت. الطلب والمرفق يُحفظان بأمان ويراهما فريق الدعم والمشرفون فقط.</Text>
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>طلب جديد</Text>
      <TextInput value={subject} onChangeText={setSubject} placeholder="عنوان المشكلة" placeholderTextColor={colors.textMuted} style={styles.input} maxLength={160} />
      <View style={styles.categories}>{categories.map((item) => <Pressable key={item.key} onPress={() => setCategory(item.key)} style={[styles.category, category === item.key && styles.categorySelected]}><Text style={[styles.categoryText, category === item.key && styles.categoryTextSelected]}>{item.label}</Text></Pressable>)}</View>
      <TextInput value={description} onChangeText={setDescription} placeholder="اشرح ما حدث والخطوات التي سبقت المشكلة…" placeholderTextColor={colors.textMuted} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" maxLength={8000} />
      {picked ? <Text style={styles.fileLabel}>الصورة: {picked.part.name}</Text> : null}
      <View style={styles.actions}>
        <Pressable onPress={() => void chooseImage()} disabled={sending} style={styles.secondaryButton}><Text style={styles.secondaryText}>{picked ? "تغيير الصورة" : "إرفاق صورة"}</Text></Pressable>
        {picked ? <Pressable onPress={() => setPicked(null)} style={styles.removeButton}><Text style={styles.removeText}>إزالة</Text></Pressable> : null}
        <Pressable onPress={() => void submit()} disabled={sending} style={[styles.primaryButton, sending && styles.disabled]}><Text style={styles.primaryText}>{sending ? "جارٍ الإرسال…" : "إرسال الطلب"}</Text></Pressable>
      </View>
    </View>
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>طلباتي</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : tickets.length === 0 ? <Text style={styles.empty}>لا توجد طلبات دعم حتى الآن.</Text> : tickets.map((ticket) => <Pressable key={ticket.id} onPress={() => void openTicket(ticket)} style={styles.ticketRow}>
        <View style={styles.ticketTop}><Text style={styles.ticketSubject}>{ticket.subject}</Text><Text style={styles.badge}>{statusLabel[ticket.status] ?? ticket.status}</Text></View>
        <Text numberOfLines={2} style={styles.ticketDescription}>{ticket.description}</Text>
        <Text style={styles.date}>{new Date(ticket.updated_at).toLocaleString("ar-EG")}</Text>
      </Pressable>)}
    </View>
    <Modal visible={Boolean(selected)} animationType="slide" onRequestClose={() => setSelected(null)}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}><Pressable onPress={() => setSelected(null)}><Text style={styles.link}>إغلاق</Text></Pressable><Text style={styles.modalTitle} numberOfLines={1}>{selected?.subject}</Text></View>
        {detailLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : <ScrollView contentContainerStyle={styles.modalContent}>
          {selected ? <View style={styles.card}><Text style={styles.badge}>{statusLabel[selected.status] ?? selected.status}</Text><Text style={styles.modalDescription}>{selected.description}</Text></View> : null}
          {attachments.map((item) => <View key={item.id} style={styles.card}><Text style={styles.ticketSubject}>{item.original_filename || "مرفق"}</Text>{item.mime_type?.startsWith("image/") ? <Image source={{ uri: item.url }} style={styles.attachmentImage} resizeMode="contain" /> : <Text style={styles.link}>{item.url}</Text>}</View>)}
          {replies.map((item) => <View key={item.id} style={[styles.card, item.is_admin_reply && styles.adminReply]}><Text style={styles.replyRole}>{item.is_admin_reply ? "دعم Suly" : "أنت"} · {new Date(item.created_at).toLocaleString("ar-EG")}</Text><Text style={styles.modalDescription}>{item.body}</Text></View>)}
        </ScrollView>}
        {selected && selected.status !== "closed" && selected.status !== "resolved" ? <View style={styles.replyComposer}><TextInput value={replyText} onChangeText={setReplyText} style={[styles.input, styles.replyInput]} placeholder="اكتب ردًا أو أضف تفاصيل…" placeholderTextColor={colors.textMuted} multiline /><Pressable style={styles.primaryButton} onPress={() => void sendReply()}><Text style={styles.primaryText}>إرسال</Text></Pressable></View> : null}
      </View>
    </Modal>
  </ScrollView></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 16, gap: 14 },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, title: { color: colors.textPrimary, fontSize: 24, fontWeight: "800" }, link: { color: colors.primary, fontWeight: "700" }, subtitle: { color: colors.textSecondary, textAlign: "right", lineHeight: 21 },
  card: { backgroundColor: colors.surface, borderColor: colors.divider, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }, sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "700", textAlign: "right" }, input: { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, textAlign: "right" }, multiline: { minHeight: 110 },
  categories: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }, category: { borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.surfaceElevated }, categorySelected: { backgroundColor: colors.primary }, categoryText: { color: colors.textSecondary, fontSize: 12 }, categoryTextSelected: { color: "#fff", fontWeight: "700" }, fileLabel: { color: colors.textSecondary, textAlign: "right" }, actions: { flexDirection: "row-reverse", alignItems: "center", gap: 8, flexWrap: "wrap" },
  primaryButton: { minHeight: 42, borderRadius: 10, backgroundColor: colors.primary, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#fff", fontWeight: "700" }, secondaryButton: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }, secondaryText: { color: colors.primary, fontWeight: "700" }, removeButton: { padding: 9 }, removeText: { color: colors.error }, disabled: { opacity: 0.55 },
  empty: { color: colors.textMuted, textAlign: "right", paddingVertical: 8 }, ticketRow: { borderTopWidth: 1, borderColor: colors.divider, paddingTop: 10, gap: 6 }, ticketTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, ticketSubject: { color: colors.textPrimary, fontWeight: "700", textAlign: "right", flex: 1 }, badge: { color: colors.primary, backgroundColor: "#10B98122", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, overflow: "hidden", fontSize: 11 }, ticketDescription: { color: colors.textSecondary, textAlign: "right" }, date: { color: colors.textMuted, fontSize: 11, textAlign: "right" },
  modalRoot: { flex: 1, backgroundColor: colors.background, paddingTop: 48 }, modalHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1, borderColor: colors.divider }, modalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", flex: 1, textAlign: "right" }, modalContent: { padding: 14, gap: 10 }, modalDescription: { color: colors.textPrimary, textAlign: "right", lineHeight: 22 }, attachmentImage: { width: "100%", height: 260, borderRadius: 10, backgroundColor: colors.surfaceElevated }, adminReply: { borderColor: colors.primary }, replyRole: { color: colors.primary, textAlign: "right", fontSize: 12, fontWeight: "700" }, replyComposer: { borderTopWidth: 1, borderColor: colors.divider, padding: 12, gap: 8 }, replyInput: { maxHeight: 100 }, loader: { marginTop: 30 },
});
