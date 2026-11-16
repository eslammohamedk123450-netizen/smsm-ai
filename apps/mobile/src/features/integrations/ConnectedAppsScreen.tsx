import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { integrationService, type ToolkitStatus } from "./integration-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";
import { useToast } from "../../components/ui/Toast";

const TOOLKIT_ICONS: Record<ToolkitStatus["toolkit"], keyof typeof Ionicons.glyphMap> = {
  gmail: "mail-outline",
  googledrive: "cloud-outline",
  github: "logo-github",
};

export default function ConnectedAppsScreen() {
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const { show } = useToast();
  const [statuses, setStatuses] = useState<ToolkitStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serviceReady, setServiceReady] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState<ToolkitStatus["toolkit"] | null>(null);
  const [addSheetVisible, setAddSheetVisible] = useState(false);

  const load = useCallback(async (showSuccess = false) => {
    setRefreshing(true);
    try {
      const result = await integrationService.getStatus();
      setStatuses(result.toolkits);
      setServiceReady(result.serviceReady);
      if (showSuccess) show(isArabic ? "تم فحص خدمة الموصلات وحالة الحسابات." : "Connector service and account status checked.", "success");
    } catch (cause) {
      setServiceReady(false);
      show(cause instanceof Error ? cause.message : (isArabic ? "تعذّر تحميل حالة التطبيقات المرتبطة." : "Could not load connected app status."), "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [show]);

  useFocusEffect(useCallback(() => {
    void load();
    return undefined;
  }, [load]));

  const connect = async (toolkit: ToolkitStatus["toolkit"]) => {
    setAddSheetVisible(false);
    setConnecting(toolkit);
    try {
      const completed = await integrationService.openConnectFlow(toolkit);
      if (completed) show(isArabic ? "عادت صفحة الربط. حدّث الحالة للتأكد من اكتمال الاتصال." : "Returned from the connection page. Refresh to verify the connection.", "success");
      await load();
    } catch (cause) {
      show(cause instanceof Error ? cause.message : (isArabic ? "تعذّر بدء ربط التطبيق." : "Could not start app connection."), "error");
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = (status: ToolkitStatus) => {
    if (!status.accountId) { show(isArabic ? "تعذر تحديد حساب الاتصال. حدّث الحالة وحاول مجددًا." : "Could not identify the connected account. Refresh and try again.", "error"); return; }
    Alert.alert(
      isArabic ? `قطع اتصال ${status.label}؟` : `Disconnect ${status.label}?`,
      isArabic ? "سيُحذف الاتصال من Suly ويُطلب إلغاء صلاحية التطبيق لدى الخدمة. ستحتاج إلى ربطه مجددًا لاستخدامه لاحقًا." : "The SULY connection will be removed and the provider will be asked to revoke its access. Reconnect it to use it again.",
      [
        { text: isArabic ? "إلغاء" : "Cancel", style: "cancel" },
        { text: isArabic ? "قطع الاتصال" : "Disconnect", style: "destructive", onPress: () => void performDisconnect(status) },
      ],
    );
  };

  const performDisconnect = async (status: ToolkitStatus) => {
    if (!status.accountId) return;
    setConnecting(status.toolkit);
    try {
      await integrationService.disconnect(status.toolkit, status.accountId);
      show(isArabic ? `تم قطع اتصال ${status.label}.` : `Disconnected ${status.label}.`, "success");
      await load();
    } catch (cause) {
      show(cause instanceof Error ? cause.message : (isArabic ? "تعذّر قطع اتصال التطبيق." : "Could not disconnect the app."), "error");
    } finally {
      setConnecting(null);
    }
  };

  const labels: Record<ToolkitStatus["toolkit"], string> = {
    gmail: "Gmail",
    googledrive: "Google Drive",
    github: "GitHub",
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.heading}>{isArabic ? "التكاملات" : "Integrations"}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => void load(true)}
            disabled={refreshing}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={isArabic ? "إعادة فحص الموصلات" : "Refresh connectors"}
          >
            {refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh-outline" size={19} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setAddSheetVisible(true)}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel={isArabic ? "إضافة موصل" : "Add connector"}
          >
            <Ionicons name="add" size={19} color={colors.background} />
            <Text style={styles.addText}>{isArabic ? "إضافة موصل" : "Add connector"}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.explainer}>
        {isArabic ? "اربط Gmail أو Google Drive أو GitHub. الفحص يراجع اتصال الخدمة وحالة الربط فقط، ولا يفتح رسائل أو ملفات ولا يغيّر بيانات حسابك." : "Connect Gmail, Google Drive, or GitHub. The check verifies service and connection status only; it does not open messages or files or change your account data."}
      </Text>

      <View style={[styles.serviceStatus, serviceReady === true ? styles.serviceReady : serviceReady === false ? styles.serviceError : null]}>
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={serviceReady ? "checkmark-circle-outline" : "alert-circle-outline"} size={18} color={serviceReady ? colors.success : colors.error} />}
        <Text style={styles.serviceStatusText}>
          {loading ? (isArabic ? "جارٍ فحص خدمة الموصلات…" : "Checking connector service…") : serviceReady ? (isArabic ? "خدمة الموصلات تستجيب" : "Connector service is responding") : (isArabic ? "تعذّر فحص خدمة الموصلات" : "Connector service check failed")}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        statuses.map((status) => (
          <View key={status.toolkit} style={styles.card}>
            <View style={styles.iconCircle}><Ionicons name={TOOLKIT_ICONS[status.toolkit]} size={22} color={colors.primary} /></View>
            <View style={styles.copy}>
              <Text style={styles.name}>{status.label}</Text>
              <Text style={styles.state}>{status.connected ? (isArabic ? "الحساب متصل ونشط" : "Account connected and active") : status.disabled ? (isArabic ? "الحساب مرتبط لكنه معطّل" : "Account connected but disabled") : status.accountExists ? (isArabic ? "الحساب مرتبط لكنه غير نشط" : "Account connected but inactive") : (isArabic ? "الحساب غير مرتبط" : "Account not connected")}</Text>
              {status.updatedAt ? <Text style={styles.updated}>آخر تحديث: {new Date(status.updatedAt).toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text> : null}
            </View>
            {status.connected ? (
              <TouchableOpacity activeOpacity={0.7} style={styles.disconnectButton} disabled={connecting !== null} onPress={() => disconnect(status)} accessibilityRole="button" accessibilityLabel={`قطع اتصال ${status.label}`}>
                {connecting === status.toolkit ? <ActivityIndicator size="small" color={colors.error} /> : <Text style={styles.disconnectText}>{isArabic ? "قطع الاتصال" : "Disconnect"}</Text>}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.connectButton}
                disabled={connecting !== null}
                onPress={() => void connect(status.toolkit)}
                accessibilityRole="button"
                accessibilityLabel={`ربط ${status.label}`}
              >
                {connecting === status.toolkit ? <ActivityIndicator size="small" color={colors.background} /> : <Text style={styles.connectText}>{isArabic ? "ربط" : "Connect"}</Text>}
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      <Text style={styles.note}>
        {isArabic ? "بعد الربط، اكتب طلبك في المحادثة. تُنفّذ القراءة بعد فحص الاتصال، أما الإرسال أو التعديل أو الحذف فيحتاج تأكيدك قبل التنفيذ، وبشرط أن تكون الأداة مدعومة ومتاحة من الموصل." : "After connecting, make your request in chat. Read actions run after a connection check; sending, editing, or deleting always requires your confirmation and a supported connector action."}
      </Text>

      <Modal visible={addSheetVisible} transparent animationType="fade" onRequestClose={() => setAddSheetVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.addSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{isArabic ? "إضافة موصل" : "Add connector"}</Text>
              <TouchableOpacity onPress={() => setAddSheetVisible(false)} accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق" : "Close"}>
                <Ionicons name="close" size={23} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetHint}>{isArabic ? "اختر التطبيق الذي تريد ربطه بحسابك." : "Choose the app you want to connect."}</Text>
            {(Object.keys(labels) as ToolkitStatus["toolkit"][]).map((toolkit) => {
              const status = statuses.find((item) => item.toolkit === toolkit);
              return (
                <TouchableOpacity
                  key={toolkit}
                  activeOpacity={0.75}
                  style={styles.providerOption}
                  onPress={() => void connect(toolkit)}
                  disabled={connecting !== null || status?.connected === true}
                  accessibilityRole="button"
                >
                  <View style={styles.providerIcon}><Ionicons name={TOOLKIT_ICONS[toolkit]} size={21} color={colors.primary} /></View>
                  <Text style={styles.providerName}>{labels[toolkit]}</Text>
                  <Text style={status?.connected ? styles.providerConnected : styles.providerAction}>{status?.connected ? (isArabic ? "مرتبط" : "Connected") : (isArabic ? "ربط" : "Connect")}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  heading: { color: colors.textPrimary, fontSize: 22, fontWeight: "700" },
  headerActions: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  addButton: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 12, height: 40, borderRadius: 13, backgroundColor: colors.primary },
  addText: { color: colors.background, fontSize: 12, fontWeight: "800" },
  explainer: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, textAlign: isArabic ? "right" : "left", marginTop: 9 },
  serviceStatus: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 8, marginTop: 16, padding: 12, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  serviceReady: { borderColor: "rgba(16,185,129,0.4)" },
  serviceError: { borderColor: "rgba(248,113,113,0.45)" },
  serviceStatusText: { color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
  loader: { marginTop: 24 },
  card: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, marginTop: 14 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, alignItems: "flex-end", gap: 3 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  state: { color: colors.textSecondary, fontSize: 12 },
  updated: { color: colors.textMuted, fontSize: 9 },
  badge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(16,185,129,0.14)", borderWidth: 1, borderColor: "rgba(16,185,129,0.4)" },
  badgeText: { color: colors.success, fontSize: 12, fontWeight: "700" },
  connectButton: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.primary, minWidth: 74, alignItems: "center", justifyContent: "center" },
  connectText: { color: colors.background, fontWeight: "800", fontSize: 13 },
  disconnectButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.surface, borderColor: colors.error, borderWidth: 1, minWidth: 94, alignItems: "center", justifyContent: "center" },
  disconnectText: { color: colors.error, fontWeight: "800", fontSize: 11 },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 20, textAlign: isArabic ? "right" : "left", marginTop: 18 },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 22, backgroundColor: "rgba(0,0,0,0.72)" },
  addSheet: { width: "100%", maxWidth: 520, borderRadius: 20, padding: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  sheetHeader: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  sheetHint: { color: colors.textSecondary, textAlign: isArabic ? "right" : "left", fontSize: 12, marginTop: 7, marginBottom: 10 },
  providerOption: { minHeight: 58, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 11, borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: 8 },
  providerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
  providerName: { flex: 1, color: colors.textPrimary, fontSize: 14, textAlign: isArabic ? "right" : "left", fontWeight: "600" },
  providerAction: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  providerConnected: { color: colors.success, fontSize: 12, fontWeight: "700" },
});
