import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../auth/auth-provider";
import { useSulyTheme } from "../../theme/ThemeProvider";
import { useAppLocale } from "../../theme/LocaleProvider";

export default function ProfileDetailsScreen() {
  const { user, profileFullName, logout } = useAuth();
  const router = useRouter();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const { show } = useToast();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [deleteRequestVisible, setDeleteRequestVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const name = profileFullName?.trim()
    || (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "")
    || "Suly";
  const avatarUrl = typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;

  const copyUserId = async () => {
    if (!user?.id) return;
    try {
      await Clipboard.setStringAsync(user.id);
      show(isArabic ? "تم نسخ معرف المستخدم." : "User ID copied.", "success");
    } catch {
      show(isArabic ? "تعذر نسخ المعرف." : "Could not copy the ID.", "error");
    }
  };

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/(auth)/login");
    } catch {
      show(isArabic ? "تعذر تسجيل الخروج. حاول مرة أخرى." : "Sign out failed. Try again.", "error");
    } finally {
      setLoggingOut(false);
      setLogoutVisible(false);
    }
  };

  const continueDeletionRequest = () => {
    setDeleteRequestVisible(false);
    router.push({ pathname: "/(protected)/support", params: { request: "account_deletion" } });
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={[styles.header, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
          <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel={isArabic ? "رجوع" : "Back"}>
            <Ionicons name={isArabic ? "arrow-forward" : "arrow-back"} size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.heading}>{isArabic ? "تفاصيل الملف الشخصي" : "Profile details"}</Text>
        </View>

        <View style={[styles.profileCard, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
          <View style={styles.avatar}>
            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>}
          </View>
          <View style={[styles.profileCopy, { alignItems: isArabic ? "flex-end" : "flex-start" }]}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{user?.email ?? "—"}</Text>
          </View>
        </View>

        <Text style={styles.section}>{isArabic ? "معرف المستخدم" : "User ID"}</Text>
        <Pressable onPress={() => void copyUserId()} style={[styles.infoRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} accessibilityRole="button">
          <View style={[styles.infoCopy, { alignItems: isArabic ? "flex-end" : "flex-start" }]}>
            <Text style={styles.infoValue} selectable>{user?.id ?? "—"}</Text>
            <Text style={styles.infoHint}>{isArabic ? "اضغط لنسخ المعرف" : "Tap to copy ID"}</Text>
          </View>
          <Ionicons name="copy-outline" size={19} color={colors.textSecondary} />
        </Pressable>

        <Text style={styles.section}>{isArabic ? "الأجهزة المتصلة" : "Connected devices"}</Text>
        <View style={[styles.infoRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
          <View style={[styles.infoCopy, { alignItems: isArabic ? "flex-end" : "flex-start" }]}>
            <Text style={styles.infoValue}>{isArabic ? "إدارة الأجهزة غير متاحة حاليًا" : "Device management is not available yet"}</Text>
            <Text style={styles.infoHint}>{isArabic ? "لا يوجد سجل جلسات أجهزة مخصص متصل بالتطبيق حاليًا." : "No dedicated connected-device session registry is currently available."}</Text>
          </View>
          <Ionicons name="phone-portrait-outline" size={19} color={colors.textMuted} />
        </View>

        <Text style={styles.section}>{isArabic ? "إجراءات الحساب" : "Account actions"}</Text>
        <Pressable onPress={() => setLogoutVisible(true)} style={[styles.actionRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} accessibilityRole="button">
          <Text style={styles.actionText}>{isArabic ? "تسجيل الخروج" : "Sign out"}</Text>
          <Ionicons name="log-out-outline" size={19} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={() => setDeleteRequestVisible(true)} style={[styles.actionRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} accessibilityRole="button">
          <Text style={styles.deleteText}>{isArabic ? "طلب حذف الحساب" : "Request account deletion"}</Text>
          <Ionicons name="trash-outline" size={19} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.notice}>{isArabic ? "الحذف المباشر غير متاح بعد لعدم وجود مسار آمن معتمد لحذف الحساب وبياناته. يمكنك إرسال طلب رسمي للدعم؛ إرسال الطلب لا يحذف الحساب تلقائيًا." : "Direct deletion is not available yet because no approved safe account-and-data deletion workflow exists. You can submit a formal support request; submitting it does not automatically delete the account."}</Text>
      </ScrollView>

      <BottomSheet visible={logoutVisible} title={isArabic ? "تسجيل الخروج؟" : "Sign out?"} onClose={() => setLogoutVisible(false)}>
        <Text style={styles.sheetText}>{isArabic ? "هل تريد تسجيل الخروج من هذا الحساب؟" : "Do you want to sign out of this account?"}</Text>
        <View style={[styles.sheetActions, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
          <Pressable onPress={() => setLogoutVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>{isArabic ? "إلغاء" : "Cancel"}</Text></Pressable>
          <Pressable onPress={() => void doLogout()} disabled={loggingOut} style={styles.confirmButton}><Text style={styles.confirmText}>{loggingOut ? (isArabic ? "جارٍ الخروج…" : "Signing out…") : (isArabic ? "تسجيل الخروج" : "Sign out")}</Text></Pressable>
        </View>
      </BottomSheet>

      <BottomSheet visible={deleteRequestVisible} title={isArabic ? "طلب حذف الحساب" : "Request account deletion"} onClose={() => setDeleteRequestVisible(false)}>
        <Text style={styles.sheetText}>{isArabic ? "سيتم فتح نموذج الدعم مع تعبئة طلب حذف الحساب. هذا يرسل طلبًا للمراجعة ولا يحذف الحساب تلقائيًا." : "The support form will open with an account deletion request prefilled. This submits a request for review and does not automatically delete the account."}</Text>
        <View style={[styles.sheetActions, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
          <Pressable onPress={() => setDeleteRequestVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>{isArabic ? "إلغاء" : "Cancel"}</Text></Pressable>
          <Pressable onPress={continueDeletionRequest} style={styles.confirmButton}><Text style={styles.confirmText}>{isArabic ? "متابعة للدعم" : "Continue to support"}</Text></Pressable>
        </View>
      </BottomSheet>
    </>
  );
}

const createStyles = (colors: ReturnType<typeof import("../../theme/ThemeProvider").useSulyTheme>["colors"], isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 36, gap: 10 },
  header: { alignItems: "center", gap: 12, marginBottom: 10 },
  back: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  heading: { flex: 1, color: colors.textPrimary, fontSize: 20, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  profileCard: { alignItems: "center", gap: 13, padding: 16, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, backgroundColor: colors.surface },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: 54, height: 54, borderRadius: 27 },
  avatarText: { color: colors.textPrimary, fontSize: 22, fontWeight: "800" },
  profileCopy: { flex: 1, gap: 4 },
  name: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
  email: { color: colors.textSecondary, fontSize: 12 },
  section: { color: colors.textSecondary, fontSize: 13, fontWeight: "800", marginTop: 14, textAlign: isArabic ? "right" : "left" },
  infoRow: { minHeight: 64, alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, backgroundColor: colors.surface },
  infoCopy: { flex: 1, gap: 4 },
  infoValue: { color: colors.textPrimary, fontSize: 12, fontWeight: "700", textAlign: isArabic ? "right" : "left" },
  infoHint: { color: colors.textMuted, fontSize: 10, lineHeight: 16, textAlign: isArabic ? "right" : "left" },
  actionRow: { minHeight: 52, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, backgroundColor: colors.surface },
  actionText: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  deleteText: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  notice: { color: colors.textMuted, fontSize: 11, lineHeight: 18, textAlign: isArabic ? "right" : "left" },
  sheetText: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, textAlign: isArabic ? "right" : "left" },
  sheetActions: { gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  cancelText: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  confirmButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  confirmText: { color: colors.onPrimary, fontSize: 12, fontWeight: "800" },
});
