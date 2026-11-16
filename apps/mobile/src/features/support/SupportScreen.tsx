import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";
import { logFrictionEvent } from "../telemetry/friction";
import { pickMedia, uploadMediaFile, type PickedMedia } from "../media/media-service";
import { supportService, type SupportAttachment, type SupportReply, type SupportTicket, type TicketCategory } from "./support-service";

const categories: { key: TicketCategory; labelAr: string; labelEn: string }[] = [
  { key: "bug", labelAr: "مشكلة تقنية", labelEn: "Technical issue" }, { key: "account", labelAr: "الحساب", labelEn: "Account" },
  { key: "billing", labelAr: "الرصيد والدفع", labelEn: "Credits & billing" }, { key: "content", labelAr: "المحتوى", labelEn: "Content" }, { key: "other", labelAr: "أخرى", labelEn: "Other" },
];
const statusLabelAr: Record<string, string> = { new: "جديد", in_progress: "قيد المعالجة", waiting_user: "بانتظارك", resolved: "تم الحل", closed: "مغلق" };
const statusLabelEn: Record<string, string> = { new: "New", in_progress: "In progress", waiting_user: "Waiting for you", resolved: "Resolved", closed: "Closed" };

export function SupportScreen() {
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
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
    catch (cause) { Alert.alert(isArabic ? "الدعم" : "Support", cause instanceof Error ? cause.message : (isArabic ? "تعذر تحميل الطلبات." : "Could not load tickets.")); }
    finally { setLoading(false); }
  }, [isArabic]);
  useEffect(() => { void refresh(); }, [refresh]);

  const chooseImage = async () => {
    try { setPicked(await pickMedia("image")); }
    catch (cause) { Alert.alert(isArabic ? "تعذر اختيار الصورة" : "Could not select image", cause instanceof Error ? cause.message : (isArabic ? "حاول مرة أخرى." : "Try again.")); }
  };

  const submit = async () => {
    if (subject.trim().length < 3 || description.trim().length < 3) {
      Alert.alert(isArabic ? "أكمل بيانات الطلب" : "Complete the ticket details", isArabic ? "اكتب عنوانًا ووصفًا لا يقل كل منهما عن 3 أحرف." : "Enter a title and a description of at least 3 characters each."); return;
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
      Alert.alert(attachmentFailed ? (isArabic ? "تم إرسال الطلب دون الصورة" : "Ticket sent without image") : (isArabic ? "تم إرسال طلب الدعم" : "Support ticket sent"), attachmentFailed ? (isArabic ? "حُفظ وصف المشكلة، لكن تعذر رفع الصورة. يمكنك إرسالها بردّ لاحقًا." : "The issue was saved, but the image could not be uploaded. You can attach it in a later reply.") : (isArabic ? "سيظهر الطلب في صندوق دعم المشرف." : "Your ticket will appear in the admin support inbox."));
    } catch (cause) {
      void logFrictionEvent({ eventKind: "action_failed", screenKey: "support", featureKey: "support", stepKey: "ticket_submit", errorCode: "ticket_submit_failed" });
      Alert.alert(isArabic ? "تعذر إرسال الطلب" : "Could not send ticket", cause instanceof Error ? cause.message : (isArabic ? "حاول مرة أخرى." : "Try again."));
    } finally { setSending(false); }
  };

  const openTicket = async (ticket: SupportTicket) => {
    setSelected(ticket); setDetailLoading(true); setReplies([]); setAttachments([]);
    try {
      const [nextReplies, nextAttachments] = await Promise.all([supportService.listReplies(ticket.id), supportService.attachments(ticket.id)]);
      setReplies(nextReplies); setAttachments(nextAttachments);
    } catch (cause) { Alert.alert(isArabic ? "تعذر تحميل الطلب" : "Could not load ticket", cause instanceof Error ? cause.message : (isArabic ? "حاول مرة أخرى." : "Try again.")); }
    finally { setDetailLoading(false); }
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    try {
      await supportService.reply(selected.id, replyText);
      setReplyText("");
      setReplies(await supportService.listReplies(selected.id));
      await refresh();
    } catch (cause) { Alert.alert(isArabic ? "تعذر إرسال الرد" : "Could not send reply", cause instanceof Error ? cause.message : (isArabic ? "حاول مرة أخرى." : "Try again.")); }
  };

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}><ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Text style={styles.title}>{isArabic ? "الدعم والشكاوى" : "Support & feedback"}</Text><Pressable onPress={() => void refresh()}><Text style={styles.link}>{isArabic ? "تحديث" : "Refresh"}</Text></Pressable></View>
    <Text style={styles.subtitle}>{isArabic ? "اكتب وصف المشكلة، وأرفق صورة توضيحية إن احتجت. الطلب والمرفق يُحفظان بأمان ويراهما فريق الدعم والمشرفون فقط." : "Describe the issue and attach an image if helpful. Your ticket and attachment are private to the support team and administrators."}</Text>
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{isArabic ? "طلب جديد" : "New ticket"}</Text>
      <TextInput value={subject} onChangeText={setSubject} placeholder={isArabic ? "عنوان المشكلة" : "Issue title"} placeholderTextColor={colors.textMuted} style={styles.input} maxLength={160} />
      <View style={styles.categories}>{categories.map((item) => <Pressable key={item.key} onPress={() => setCategory(item.key)} style={[styles.category, category === item.key && styles.categorySelected]}><Text style={[styles.categoryText, category === item.key && styles.categoryTextSelected]}>{isArabic ? item.labelAr : item.labelEn}</Text></Pressable>)}</View>
      <TextInput value={description} onChangeText={setDescription} placeholder={isArabic ? "اشرح ما حدث والخطوات التي سبقت المشكلة…" : "Describe what happened and the steps before the issue…"} placeholderTextColor={colors.textMuted} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" maxLength={8000} />
      {picked ? <Text style={styles.fileLabel}>{isArabic ? `الصورة: ${picked.part.name}` : `Image: ${picked.part.name}`}</Text> : null}
      <View style={styles.actions}>
        <Pressable onPress={() => void chooseImage()} disabled={sending} style={styles.secondaryButton}><Text style={styles.secondaryText}>{picked ? (isArabic ? "تغيير الصورة" : "Change image") : (isArabic ? "إرفاق صورة" : "Attach image")}</Text></Pressable>
        {picked ? <Pressable onPress={() => setPicked(null)} style={styles.removeButton}><Text style={styles.removeText}>{isArabic ? "إزالة" : "Remove"}</Text></Pressable> : null}
        <Pressable onPress={() => void submit()} disabled={sending} style={[styles.primaryButton, sending && styles.disabled]}><Text style={styles.primaryText}>{sending ? (isArabic ? "جارٍ الإرسال…" : "Sending…") : (isArabic ? "إرسال الطلب" : "Submit ticket")}</Text></Pressable>
      </View>
    </View>
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{isArabic ? "طلباتي" : "My tickets"}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : tickets.length === 0 ? <Text style={styles.empty}>{isArabic ? "لا توجد طلبات دعم حتى الآن." : "No support tickets yet."}</Text> : tickets.map((ticket) => <Pressable key={ticket.id} onPress={() => void openTicket(ticket)} style={styles.ticketRow}>
        <View style={styles.ticketTop}><Text style={styles.ticketSubject}>{ticket.subject}</Text><Text style={styles.badge}>{(isArabic ? statusLabelAr[ticket.status] : statusLabelEn[ticket.status]) ?? ticket.status}</Text></View>
        <Text numberOfLines={2} style={styles.ticketDescription}>{ticket.description}</Text>
        <Text style={styles.date}>{new Date(ticket.updated_at).toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text>
      </Pressable>)}
    </View>
    <Modal visible={Boolean(selected)} animationType="slide" onRequestClose={() => setSelected(null)}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}><Pressable onPress={() => setSelected(null)}><Text style={styles.link}>{isArabic ? "إغلاق" : "Close"}</Text></Pressable><Text style={styles.modalTitle} numberOfLines={1}>{selected?.subject}</Text></View>
        {detailLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : <ScrollView contentContainerStyle={styles.modalContent}>
          {selected ? <View style={styles.card}><Text style={styles.badge}>{(isArabic ? statusLabelAr[selected.status] : statusLabelEn[selected.status]) ?? selected.status}</Text><Text style={styles.modalDescription}>{selected.description}</Text></View> : null}
          {attachments.map((item) => <View key={item.id} style={styles.card}><Text style={styles.ticketSubject}>{item.original_filename || (isArabic ? "مرفق" : "Attachment")}</Text>{item.mime_type?.startsWith("image/") ? <Image source={{ uri: item.url }} style={styles.attachmentImage} resizeMode="contain" /> : <Text style={styles.link}>{item.url}</Text>}</View>)}
          {replies.map((item) => <View key={item.id} style={[styles.card, item.is_admin_reply && styles.adminReply]}><Text style={styles.replyRole}>{item.is_admin_reply ? (isArabic ? "دعم Suly" : "SULY Support") : (isArabic ? "أنت" : "You")} · {new Date(item.created_at).toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text><Text style={styles.modalDescription}>{item.body}</Text></View>)}
        </ScrollView>}
        {selected && selected.status !== "closed" && selected.status !== "resolved" ? <View style={styles.replyComposer}><TextInput value={replyText} onChangeText={setReplyText} style={[styles.input, styles.replyInput]} placeholder={isArabic ? "اكتب ردًا أو أضف تفاصيل…" : "Write a reply or add details…"} placeholderTextColor={colors.textMuted} multiline /><Pressable style={styles.primaryButton} onPress={() => void sendReply()}><Text style={styles.primaryText}>{isArabic ? "إرسال" : "Send"}</Text></Pressable></View> : null}
      </View>
    </Modal>
  </ScrollView></KeyboardAvoidingView>;
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 16, gap: 14 },
  header: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" }, title: { color: colors.textPrimary, fontSize: 24, fontWeight: "800" }, link: { color: colors.primary, fontWeight: "700" }, subtitle: { color: colors.textSecondary, textAlign: isArabic ? "right" : "left", lineHeight: 21 },
  card: { backgroundColor: colors.surface, borderColor: colors.divider, borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 }, sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "700", textAlign: isArabic ? "right" : "left" }, input: { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, textAlign: isArabic ? "right" : "left" }, multiline: { minHeight: 110 },
  categories: { flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 7 }, category: { borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.surfaceElevated }, categorySelected: { backgroundColor: colors.primary }, categoryText: { color: colors.textSecondary, fontSize: 12 }, categoryTextSelected: { color: "#fff", fontWeight: "700" }, fileLabel: { color: colors.textSecondary, textAlign: isArabic ? "right" : "left" }, actions: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  primaryButton: { minHeight: 44, borderRadius: 14, backgroundColor: colors.primary, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#fff", fontWeight: "700" }, secondaryButton: { minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" }, secondaryText: { color: colors.primary, fontWeight: "700" }, removeButton: { padding: 9 }, removeText: { color: colors.error }, disabled: { opacity: 0.55 },
  empty: { color: colors.textMuted, textAlign: isArabic ? "right" : "left", paddingVertical: 8 }, ticketRow: { borderTopWidth: 1, borderColor: colors.divider, paddingTop: 10, gap: 6 }, ticketTop: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" }, ticketSubject: { color: colors.textPrimary, fontWeight: "700", textAlign: isArabic ? "right" : "left", flex: 1 }, badge: { color: colors.primary, backgroundColor: "#0EA5E922", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, overflow: "hidden", fontSize: 11 }, ticketDescription: { color: colors.textSecondary, textAlign: isArabic ? "right" : "left" }, date: { color: colors.textMuted, fontSize: 11, textAlign: isArabic ? "right" : "left" },
  modalRoot: { flex: 1, backgroundColor: colors.background, paddingTop: 48 }, modalHeader: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1, borderColor: colors.divider }, modalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", flex: 1, textAlign: isArabic ? "right" : "left" }, modalContent: { padding: 14, gap: 10 }, modalDescription: { color: colors.textPrimary, textAlign: isArabic ? "right" : "left", lineHeight: 22 }, attachmentImage: { width: "100%", height: 260, borderRadius: 10, backgroundColor: colors.surfaceElevated }, adminReply: { borderColor: colors.primary }, replyRole: { color: colors.primary, textAlign: isArabic ? "right" : "left", fontSize: 12, fontWeight: "700" }, replyComposer: { borderTopWidth: 1, borderColor: colors.divider, padding: 12, gap: 8 }, replyInput: { maxHeight: 100 }, loader: { marginTop: 30 },
});
