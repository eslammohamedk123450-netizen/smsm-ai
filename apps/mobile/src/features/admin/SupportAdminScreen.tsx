import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { colors } from "../../theme/colors";
import { supportService, type SupportAttachment, type SupportReply, type SupportTicket, type TicketStatus } from "../support/support-service";

const statusLabel: Record<string, string> = { new: "جديد", in_progress: "قيد المعالجة", waiting_user: "بانتظار المستخدم", resolved: "تم الحل", closed: "مغلق" };
const statuses: TicketStatus[] = ["new", "in_progress", "waiting_user", "resolved", "closed"];

export function SupportAdminScreen() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTickets(await supportService.adminListTickets()); }
    catch (cause) { Alert.alert("صندوق الدعم", cause instanceof Error ? cause.message : "تعذر التحميل."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async (ticket: SupportTicket) => {
    setSelected(ticket); setBusy(true);
    try {
      const [nextReplies, nextAttachments] = await Promise.all([supportService.listReplies(ticket.id), supportService.attachments(ticket.id)]);
      setReplies(nextReplies); setAttachments(nextAttachments);
    } catch (cause) { Alert.alert("تعذر فتح الطلب", cause instanceof Error ? cause.message : "حاول مرة أخرى."); }
    finally { setBusy(false); }
  };
  const updateStatus = async (status: TicketStatus) => {
    if (!selected) return;
    try {
      await supportService.updateTicket(selected.id, status);
      setSelected({ ...selected, status, updated_at: new Date().toISOString() });
      await load();
    } catch (cause) { Alert.alert("تعذر تحديث الحالة", cause instanceof Error ? cause.message : "حاول مرة أخرى."); }
  };
  const reply = async () => {
    if (!selected || !replyText.trim()) return;
    try {
      setBusy(true);
      await supportService.reply(selected.id, replyText, true);
      setReplyText("");
      setReplies(await supportService.listReplies(selected.id));
      await load();
    } catch (cause) { Alert.alert("تعذر إرسال الرد", cause instanceof Error ? cause.message : "حاول مرة أخرى."); }
    finally { setBusy(false); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}><Text style={styles.title}>الدعم والشكاوى</Text><Pressable onPress={() => void load()}><Text style={styles.link}>تحديث</Text></Pressable></View>
    <Text style={styles.subtitle}>صندوق تذاكر من قاعدة البيانات؛ المرفقات تُعرض بروابط خاصة ومصرح بها.</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : tickets.length === 0 ? <Text style={styles.empty}>لا توجد طلبات دعم.</Text> : tickets.map((ticket) => <Pressable key={ticket.id} style={styles.ticket} onPress={() => void open(ticket)}>
      <View style={styles.ticketTop}><Text style={styles.badge}>{statusLabel[ticket.status] ?? ticket.status}</Text><Text style={styles.subject}>{ticket.subject}</Text></View>
      <Text style={styles.description} numberOfLines={2}>{ticket.description}</Text>
      <Text style={styles.meta}>المستخدم {ticket.user_id.slice(0, 8)}… · أولوية {ticket.priority} · {new Date(ticket.updated_at).toLocaleString("ar-EG")}</Text>
    </Pressable>)}
    {selected ? <View style={styles.detailCard}>
      <View style={styles.ticketTop}><Pressable onPress={() => setSelected(null)}><Text style={styles.link}>إغلاق التفاصيل</Text></Pressable><Text style={styles.detailTitle}>{selected.subject}</Text></View>
      <Text style={styles.description}>{selected.description}</Text>
      <Text style={styles.meta}>الحالة: {statusLabel[selected.status] ?? selected.status} · التصنيف: {selected.category} · المستخدم: {selected.user_id}</Text>
      <View style={styles.statuses}>{statuses.map((status) => <Pressable key={status} style={[styles.statusButton, selected.status === status && styles.statusSelected]} onPress={() => void updateStatus(status)}><Text style={[styles.statusText, selected.status === status && styles.statusTextSelected]}>{statusLabel[status]}</Text></Pressable>)}</View>
      {busy ? <ActivityIndicator color={colors.primary} /> : null}
      {attachments.map((item) => <View key={item.id} style={styles.attachment}><Text style={styles.meta}>{item.original_filename || "مرفق"} · {Math.ceil(item.size_bytes / 1024)} KB</Text>{item.mime_type?.startsWith("image/") ? <Image source={{ uri: item.url }} style={styles.image} resizeMode="contain" /> : <Text selectable style={styles.link}>{item.url}</Text>}</View>)}
      {replies.map((item) => <View key={item.id} style={[styles.reply, item.is_admin_reply && styles.adminReply]}><Text style={styles.meta}>{item.is_admin_reply ? "الدعم" : "المستخدم"} · {new Date(item.created_at).toLocaleString("ar-EG")}</Text><Text style={styles.description}>{item.body}</Text></View>)}
      <TextInput value={replyText} onChangeText={setReplyText} style={styles.input} placeholder="اكتب ردًا للمستخدم…" placeholderTextColor={colors.textMuted} multiline />
      <Pressable onPress={() => void reply()} disabled={busy} style={[styles.sendButton, busy && styles.disabled]}><Text style={styles.sendText}>{busy ? "جارٍ الإرسال…" : "إرسال الرد"}</Text></Pressable>
    </View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { maxWidth: 1000, width: "100%", alignSelf: "center", padding: 16, gap: 12 }, header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, title: { color: colors.textPrimary, fontSize: 23, fontWeight: "800" }, link: { color: colors.primary, fontWeight: "700" }, subtitle: { color: colors.textSecondary, textAlign: "right" }, empty: { color: colors.textMuted, textAlign: "right" }, ticket: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, gap: 7 }, ticketTop: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" }, badge: { color: colors.primary, fontSize: 11, fontWeight: "700", backgroundColor: "#0EA5E922", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 14, overflow: "hidden" }, subject: { color: colors.textPrimary, fontWeight: "700", textAlign: "right", flex: 1 }, description: { color: colors.textPrimary, textAlign: "right", lineHeight: 21 }, meta: { color: colors.textMuted, fontSize: 11, textAlign: "right" }, detailCard: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface, gap: 10, marginTop: 8 }, detailTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 18, textAlign: "right", flex: 1 }, statuses: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }, statusButton: { backgroundColor: colors.surfaceElevated, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 }, statusSelected: { backgroundColor: colors.primary }, statusText: { color: colors.textSecondary, fontSize: 11 }, statusTextSelected: { color: "#fff", fontWeight: "700" }, attachment: { borderTopWidth: 1, borderColor: colors.divider, paddingTop: 9, gap: 8 }, image: { width: "100%", height: 260, borderRadius: 10, backgroundColor: colors.surfaceElevated }, reply: { backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 10, gap: 5 }, adminReply: { borderWidth: 1, borderColor: colors.primary }, input: { minHeight: 90, maxHeight: 160, textAlign: "right", color: colors.textPrimary, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, padding: 11 }, sendButton: { minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 20 }, sendText: { color: "#fff", fontWeight: "700" }, disabled: { opacity: 0.5 } });
