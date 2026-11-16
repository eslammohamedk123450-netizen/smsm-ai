import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useLocalSearchParams } from "expo-router";
import { adminService } from "./admin-service";
import { confirmAdminAction } from "./admin-confirm";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type User = { id: string; email: string; full_name: string | null; subscription_tier: string | null; is_banned: boolean; balance: number; reserved_balance: number };
type Filter = "all" | "active" | "banned";
type SubscriptionPlan = Awaited<ReturnType<typeof adminService.getActiveSubscriptionPlans>>[number];
const Button = ({ label, onPress, styles, danger = false }: { label: string; onPress(): void; styles: ReturnType<typeof createStyles>; danger?: boolean }) => <Pressable onPress={onPress} style={[styles.smallButton, danger && styles.dangerButton]}><Text style={[styles.smallButtonText, danger && styles.dangerText]}>{label}</Text></Pressable>;

export function AdminUsersCommandScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersAvailable, setUsersAvailable] = useState(false);
  const pageSize = 50;
  const [search, setSearch] = useState(typeof q === "string" ? q : "");
  const [debouncedSearch, setDebouncedSearch] = useState(typeof q === "string" ? q : "");
  const requestVersion = useRef(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [subscriptionUser, setSubscriptionUser] = useState<User | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptionPlanId, setSubscriptionPlanId] = useState("");
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState("");
  const [subscriptionReason, setSubscriptionReason] = useState("");
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const load = async () => {
    const request = ++requestVersion.current;
    setLoading(true);
    setUsersAvailable(false);
    setError(null);
    try {
      const result = await adminService.getUsersPage(page, pageSize, debouncedSearch, filter);
      if (request !== requestVersion.current) return;
      setUsers(result.users as User[]);
      setTotalUsers(result.total);
      setUsersAvailable(true);
    } catch {
      if (request === requestVersion.current) { setUsers([]); setTotalUsers(0); setSelected([]); setUsersAvailable(false); setError("تعذر تحميل المستخدمين. تحقق من صلاحية الأدمن وسياسات RLS."); }
    } finally {
      if (request === requestVersion.current) setLoading(false);
    }
  };
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);
  useEffect(() => { void load(); return () => { requestVersion.current += 1; }; }, [page, debouncedSearch, filter]);
  useEffect(() => { if (typeof q === "string") { setSearch(q); setPage(0); setSelected([]); } }, [q]);
  const filtered = users;
  const allVisibleSelected = filtered.length > 0 && filtered.every((user) => selected.includes(user.id));
  const toggleSelect = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAll = () => setSelected((current) => allVisibleSelected ? current.filter((id) => !filtered.some((user) => user.id === id)) : [...new Set([...current, ...filtered.map((user) => user.id)])]);
  const bulkBan = async (banned: boolean) => {
    const targets = users.filter((user) => selected.includes(user.id) && user.is_banned !== banned);
    if (!targets.length) return;
    if (!await confirmAdminAction(banned ? "تأكيد الحظر الجماعي" : "تأكيد إلغاء الحظر الجماعي", `سيتم ${banned ? "حظر" : "إلغاء حظر"} ${targets.length} مستخدم.`, "تأكيد التنفيذ")) return;
    setBusy(true); setError(null);
    try { for (const user of targets) await adminService.setUserBanned(user.id, banned); setSelected([]); await load(); }
    catch { setError("توقف الإجراء عند حدوث خطأ؛ راجع الحالات الحالية وسجل النشاط."); }
    finally { setBusy(false); }
  };
  const bulkCredit = async () => {
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value === 0 || !reason.trim()) { setError("أدخل مبلغًا صحيحًا غير صفري وسببًا إلزاميًا."); return; }
    if (!await confirmAdminAction("تأكيد الشحن الجماعي؟", `سيُعدّل الرصيد بمقدار ${value} لكل مستخدم من ${selected.length} مستخدم. السبب: ${reason.trim()}`, "تنفيذ الشحن")) return;
    setBusy(true); setError(null);
    try {
      for (const id of selected) { const result = await adminService.adjustCredits(id, value, reason.trim()); if (result.success !== true) throw new Error("تعذر تعديل رصيد أحد الحسابات."); }
      setSelected([]); setCreditOpen(false); setAmount(""); setReason(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إكمال الشحن الجماعي. تحقق من سجل النشاط والأرصدة."); }
    finally { setBusy(false); }
  };
  const toggleUser = async (user: User) => {
    const next = !user.is_banned;
    if (!await confirmAdminAction(next ? "حظر المستخدم؟" : "إلغاء الحظر؟", `${user.email} ${next ? "لن يستطيع استخدام الخدمة." : "سيتمكن من استخدام الخدمة مجددًا."}`, "تأكيد")) return;
    try { await adminService.setUserBanned(user.id, next); await load(); } catch { setError("تعذر تغيير حالة المستخدم."); }
  };
  const openSubscription = async (user: User) => {
    setSubscriptionUser(user);
    setSubscriptionOpen(true);
    setSubscriptionReason("");
    setSubscriptionExpiresAt("");
    setSubscriptionPlanId("");
    if (subscriptionPlans.length) {
      setSubscriptionPlanId(String(subscriptionPlans[0].id));
      return;
    }
    try {
      const plans = await adminService.getActiveSubscriptionPlans();
      setSubscriptionPlans(plans);
      if (plans.length) setSubscriptionPlanId(String(plans[0].id));
      else setError("لا توجد باقات فعالة يمكن منحها.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل الباقات الفعالة.");
    }
  };

  const applySubscription = async () => {
    if (!subscriptionUser) return;
    const planId = Number(subscriptionPlanId);
    const plan = subscriptionPlans.find((item) => item.id === planId);
    if (!plan) { setError("اختر باقة فعالة."); return; }
    if (!subscriptionReason.trim() || subscriptionReason.trim().length > 500) {
      setError("سبب منح الاشتراك إلزامي (حتى 500 حرف).");
      return;
    }
    let expiresAt: string | null = null;
    if (subscriptionExpiresAt.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(subscriptionExpiresAt.trim())) {
        setError("اكتب تاريخ الانتهاء بصيغة YYYY-MM-DD أو اتركه فارغًا.");
        return;
      }
      const dateValue = subscriptionExpiresAt.trim();
      const calendarDate = new Date(`${dateValue}T00:00:00.000Z`);
      const parsed = new Date(`${dateValue}T23:59:59`);
      if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== dateValue) {
        setError("تاريخ الانتهاء غير صحيح.");
        return;
      }
      if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setError("تاريخ انتهاء الاشتراك يجب أن يكون في المستقبل.");
        return;
      }
      expiresAt = parsed.toISOString();
    }
    if (!await confirmAdminAction(
      "تأكيد منح الاشتراك؟",
      `المستخدم: ${subscriptionUser.email} · الباقة: ${plan.name} · ${expiresAt ? `ينتهي: ${subscriptionExpiresAt}` : "دون تاريخ انتهاء"} · سيتم استبدال أي اشتراك نشط سابق. السبب: ${subscriptionReason.trim()}`,
      "منح الاشتراك",
    )) return;
    setSubscriptionBusy(true);
    setError(null);
    try {
      await adminService.grantSubscription(subscriptionUser.id, plan.id, expiresAt, subscriptionReason.trim());
      setSubscriptionOpen(false);
      setSubscriptionUser(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر منح الاشتراك. راجع سجل النشاط.");
    } finally {
      setSubscriptionBusy(false);
    }
  };

  const adjustSingle = async (user: User) => { const entered = Number(amount); if (!Number.isSafeInteger(entered) || entered === 0 || !reason.trim()) { setError("أدخل مبلغًا صحيحًا وسببًا."); return; } if (!await confirmAdminAction("تأكيد تعديل الرصيد؟", `المستخدم ${user.email} · ${entered} رصيد · ${reason.trim()}`, "تنفيذ")) return; try { const result = await adminService.adjustCredits(user.id, entered, reason.trim()); if (result.success !== true) throw new Error("رفضت قاعدة البيانات العملية."); setCreditOpen(false); setAmount(""); setReason(""); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تعديل الرصيد."); } };

  return <View style={styles.screen}><View style={styles.heading}><View style={styles.headingCopy}><Text style={styles.eyebrow}>إدارة الحسابات</Text><Text style={styles.title}>المستخدمون</Text><Text style={styles.subtitle}>{usersAvailable ? totalUsers.toLocaleString("ar-EG") : "—"} حساب · صفحة {page + 1} · تحديد متعدد وإجراءات جماعية</Text></View><Button styles={styles} label="↻ تحديث" onPress={() => void load()} /></View>
    <View style={styles.toolbar}><TextInput style={styles.search} value={search} onChangeText={(value) => { setSearch(value); setPage(0); setSelected([]); }} placeholder="بحث بالاسم أو البريد أو UUID" placeholderTextColor={colors.textMuted} autoCapitalize="none" /><View style={styles.filters}>{([ ["all", "الكل"], ["active", "نشط"], ["banned", "محظور"] ] as [Filter, string][]).map(([key, label]) => <Pressable key={key} onPress={() => { setFilter(key); setPage(0); setSelected([]); }} style={[styles.filterChip, filter === key && styles.filterActive]}><Text style={[styles.filterText, filter === key && styles.filterActiveText]}>{label}</Text></Pressable>)}</View></View>
    <View style={styles.bulkBar}><Pressable onPress={toggleAll} style={styles.selectAll}><Text style={styles.checkbox}>{allVisibleSelected ? "☑" : "□"}</Text><Text style={styles.bulkCount}>تحديد الظاهر ({selected.length} محدد)</Text></Pressable><View style={styles.bulkActions}><Button styles={styles} label="شحن جماعي" onPress={() => { setCreditOpen(true); setAmount(""); setReason(""); }} /><Button styles={styles} label="حظر جماعي" danger onPress={() => void bulkBan(true)} /><Button styles={styles} label="إلغاء الحظر" onPress={() => void bulkBan(false)} /></View></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <ActivityIndicator color={colors.primary} style={{ margin: 20 }} /> : <ScrollView horizontal style={styles.tableScroll}><View><View style={styles.tableHead}><Text style={[styles.cell, styles.checkCell]}>تحديد</Text><Text style={[styles.cell, styles.userCell]}>المستخدم</Text><Text style={[styles.cell, styles.statusCell]}>الحالة</Text><Text style={[styles.cell, styles.balanceCell]}>الرصيد</Text><Text style={[styles.cell, styles.tierCell]}>الباقة</Text><Text style={[styles.cell, styles.actionCell]}>إجراء سريع</Text></View><ScrollView>{filtered.map((user) => <View key={user.id} style={styles.tableRow}><Pressable onPress={() => toggleSelect(user.id)} style={[styles.cell, styles.checkCell]}><Text style={styles.checkbox}>{selected.includes(user.id) ? "☑" : "□"}</Text></Pressable><View style={[styles.cell, styles.userCell, styles.userInfo]}><Text style={styles.userName} numberOfLines={1}>{user.full_name || user.email || user.id}</Text><Text selectable numberOfLines={1} style={styles.userEmail}>{user.email}</Text><Text selectable numberOfLines={1} style={styles.userId}>{user.id}</Text></View><View style={[styles.cell, styles.statusCell]}><Text style={[styles.status, user.is_banned && styles.statusBanned]}>{user.is_banned ? "محظور" : "نشط"}</Text></View><Text style={[styles.cell, styles.balanceCell, styles.value]}>{Number(user.balance).toLocaleString("ar-EG")} <Text style={styles.reserved}>({Number(user.reserved_balance).toLocaleString("ar-EG")} محجوز)</Text></Text><Text style={[styles.cell, styles.tierCell, styles.value]}>{user.subscription_tier ?? "free"}</Text><View style={[styles.cell, styles.actionCell, styles.actionWrap]}><Button styles={styles} label="شحن" onPress={() => { setSelected([user.id]); setCreditOpen(true); setAmount(""); setReason(""); }} /><Button styles={styles} label={user.is_banned ? "إلغاء الحظر" : "حظر"} danger={!user.is_banned} onPress={() => void toggleUser(user)} /><Button styles={styles} label="اشتراك" onPress={() => void openSubscription(user)} /></View></View>)}</ScrollView></View></ScrollView>}
    <View style={styles.pagination}>
      <Pressable accessibilityRole="button" disabled={!usersAvailable || loading || page <= 0} onPress={() => { setSelected([]); setPage((current) => Math.max(0, current - 1)); }} style={[styles.pageButton, (loading || page <= 0) && styles.pageButtonDisabled]}><Text style={styles.pageButtonText}>السابق</Text></Pressable>
      <Text style={styles.pageInfo}>{!usersAvailable ? "بيانات المستخدمين غير متاحة" : totalUsers ? `صفحة ${page + 1} من ${Math.ceil(totalUsers / pageSize)} · ${totalUsers.toLocaleString("ar-EG")} مستخدم` : "لا توجد نتائج"}</Text>
      <Pressable accessibilityRole="button" disabled={!usersAvailable || loading || (page + 1) * pageSize >= totalUsers} onPress={() => { setSelected([]); setPage((current) => current + 1); }} style={[styles.pageButton, (loading || (page + 1) * pageSize >= totalUsers) && styles.pageButtonDisabled]}><Text style={styles.pageButtonText}>التالي</Text></Pressable>
    </View>
    <Modal visible={creditOpen} transparent animationType="fade" onRequestClose={() => setCreditOpen(false)}><View style={styles.backdrop}><View style={styles.modal}><Text style={styles.modalTitle}>{selected.length > 1 ? `شحن ${selected.length} مستخدم` : "شحن رصيد مستخدم"}</Text><TextInput style={styles.modalInput} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="المبلغ (+ إضافة، - خصم)" placeholderTextColor={colors.textMuted} /><TextInput style={styles.modalInput} value={reason} onChangeText={setReason} maxLength={500} placeholder="سبب إلزامي، سيظهر في سجل التدقيق" placeholderTextColor={colors.textMuted} /><View style={styles.modalActions}><Button styles={styles} label={busy ? "جارٍ التنفيذ…" : "مراجعة وتنفيذ"} onPress={() => { const target = selected.length === 1 ? users.find((user) => user.id === selected[0]) : null; if (target) void adjustSingle(target); else void bulkCredit(); }} /><Button styles={styles} label="إلغاء" onPress={() => setCreditOpen(false)} /></View></View></View></Modal>
    <Modal visible={subscriptionOpen} transparent animationType="fade" onRequestClose={() => setSubscriptionOpen(false)}>
      <View style={styles.backdrop}><View style={styles.modal}>
        <Text style={styles.modalTitle}>إدارة اشتراك {subscriptionUser?.email ?? ""}</Text>
        <Text style={styles.modalHint}>اختر باقة فعالة من الكتالوج الحالي. لن يتم تعديل سعر الباقة أو إعداداتها.</Text>
        {subscriptionPlans.length ? <View style={styles.planList}>{subscriptionPlans.map((plan) => {
          const active = String(plan.id) === subscriptionPlanId;
          return <Pressable key={plan.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setSubscriptionPlanId(String(plan.id))} style={[styles.planChip, active && styles.planChipSelected]}>
            <Text style={[styles.planText, active && styles.planTextSelected]}>{plan.name}</Text>
            <Text style={styles.planMeta}>{plan.price.toLocaleString("en-US")} {plan.currency} · {plan.daily_credits.toLocaleString("en-US")} رصيد يومي</Text>
          </Pressable>;
        })}</View> : <Text style={styles.modalHint}>جارٍ تحميل الباقات أو لا توجد باقات فعالة.</Text>}
        <TextInput style={styles.modalInput} value={subscriptionExpiresAt} onChangeText={setSubscriptionExpiresAt} placeholder="تاريخ الانتهاء YYYY-MM-DD (اختياري)" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
        <TextInput style={[styles.modalInput, styles.reasonInput]} value={subscriptionReason} onChangeText={setSubscriptionReason} maxLength={500} placeholder="سبب منح الاشتراك إلزامي وسيُسجل في سجل التدقيق" placeholderTextColor={colors.textMuted} multiline />
        <Text style={styles.modalHint}>سيتم استبدال الاشتراك النشط السابق لهذا المستخدم، وتسجيل العملية في سجل الإدارة. اترك تاريخ الانتهاء فارغًا إذا كان الاشتراك غير محدد المدة.</Text>
        <View style={styles.modalActions}>
          <Button styles={styles} label={subscriptionBusy ? "جارٍ الحفظ…" : "مراجعة ومنح الاشتراك"} onPress={() => void applySubscription()} />
          <Button styles={styles} label="إلغاء" onPress={() => setSubscriptionOpen(false)} />
        </View>
      </View></View>
    </Modal>
  </View>;
}

function createStyles(colors: ThemePalette) { return StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background, padding: 12, gap: 9 }, heading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 }, headingCopy: { flex: 1, alignItems: "flex-end", gap: 2 }, eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "800" }, title: { color: colors.textPrimary, fontSize: 19, fontWeight: "900" }, subtitle: { color: colors.textMuted, fontSize: 9 }, toolbar: { flexDirection: "row-reverse", alignItems: "center", gap: 8 }, search: { flex: 1, minHeight: 37, borderWidth: 1, borderColor: colors.divider, borderRadius: 7, paddingHorizontal: 9, color: colors.textPrimary, textAlign: "right", fontSize: 10, backgroundColor: colors.surface }, filters: { flexDirection: "row-reverse", gap: 5 }, filterChip: { borderWidth: 1, borderColor: colors.divider, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 6 }, filterActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated }, filterText: { color: colors.textMuted, fontSize: 9 }, filterActiveText: { color: colors.primary, fontWeight: "800" }, bulkBar: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 7, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: 8, padding: 7 }, selectAll: { flexDirection: "row-reverse", alignItems: "center", gap: 5 }, checkbox: { color: colors.primary, fontSize: 16 }, bulkCount: { color: colors.textSecondary, fontSize: 9 }, bulkActions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 4 }, smallButton: { borderWidth: 1, borderColor: colors.divider, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: colors.surfaceElevated }, smallButtonText: { color: colors.textPrimary, fontSize: 8, fontWeight: "700" }, dangerButton: { borderColor: colors.error }, dangerText: { color: colors.error }, tableScroll: { flex: 1, borderWidth: 1, borderColor: colors.divider, borderRadius: 8, backgroundColor: colors.surface }, tableHead: { flexDirection: "row-reverse", minWidth: 900, backgroundColor: colors.surfaceElevated, borderBottomWidth: 1, borderBottomColor: colors.divider }, tableRow: { flexDirection: "row-reverse", minWidth: 900, minHeight: 55, borderBottomWidth: 1, borderBottomColor: colors.divider, alignItems: "center" }, cell: { paddingHorizontal: 7, paddingVertical: 6, textAlign: "right", color: colors.textSecondary, fontSize: 9 }, checkCell: { width: 54, textAlign: "center" }, userCell: { width: 250 }, userInfo: { alignItems: "flex-end", gap: 1 }, userName: { color: colors.textPrimary, fontSize: 10, fontWeight: "800", maxWidth: 230 }, userEmail: { color: colors.textSecondary, fontSize: 8, maxWidth: 230 }, userId: { color: colors.textMuted, fontSize: 7, maxWidth: 230 }, statusCell: { width: 90 }, status: { color: colors.success, fontSize: 9, textAlign: "right" }, statusBanned: { color: colors.error }, balanceCell: { width: 140 }, value: { color: colors.textPrimary }, reserved: { color: colors.textMuted, fontSize: 7 }, tierCell: { width: 85 }, actionCell: { width: 280 }, actionWrap: { flexDirection: "row-reverse", gap: 5, alignItems: "center" }, error: { color: colors.error, textAlign: "right", fontSize: 10 }, backdrop: { flex: 1, backgroundColor: colors.modalOverlay, justifyContent: "center", alignItems: "center", padding: 18 }, modal: { width: "100%", maxWidth: 430, padding: 15, borderWidth: 1, borderColor: colors.divider, borderRadius: 11, backgroundColor: colors.surface, gap: 9 }, pagination: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: 8, padding: 8 }, pageButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 7 }, pageButtonDisabled: { opacity: 0.35 }, pageButtonText: { color: colors.primary, fontSize: 9, fontWeight: "800" }, pageInfo: { flex: 1, color: colors.textMuted, textAlign: "center", fontSize: 9 }, modalTitle: { color: colors.textPrimary, textAlign: "right", fontSize: 14, fontWeight: "800" }, modalHint: { color: colors.textMuted, textAlign: "right", fontSize: 9, lineHeight: 16 }, planList: { gap: 6, maxHeight: 190 }, planChip: { borderWidth: 1, borderColor: colors.divider, borderRadius: 8, padding: 9, gap: 3, backgroundColor: colors.background }, planChipSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated }, planText: { color: colors.textPrimary, fontSize: 10, fontWeight: "800", textAlign: "right" }, planTextSelected: { color: colors.primary }, planMeta: { color: colors.textMuted, fontSize: 8, textAlign: "right" }, reasonInput: { minHeight: 70, textAlignVertical: "top", paddingTop: 9 }, modalInput: { minHeight: 40, borderWidth: 1, borderColor: colors.divider, borderRadius: 7, paddingHorizontal: 9, color: colors.textPrimary, textAlign: "right", fontSize: 10 }, modalActions: { flexDirection: "row-reverse", gap: 8, justifyContent: "flex-start" } }); }
