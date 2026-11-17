import { type ErrorBoundaryProps, Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../../src/components/ui/PremiumText";
import { useSulyTheme } from "../../../src/theme/ThemeProvider";
import { MediaModelsCatalogScreen } from "../../../src/features/admin/MediaModelsCatalogScreen";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useSulyTheme();
  const styles = StyleSheet.create({
    screen: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12, backgroundColor: colors.background },
    title: { color: colors.error, fontSize: 18, fontWeight: "900", textAlign: "center" },
    message: { color: colors.textSecondary, fontSize: 11, lineHeight: 18, textAlign: "center", maxWidth: 520 },
    button: { borderWidth: 1, borderColor: colors.primary, borderRadius: 9, paddingHorizontal: 18, paddingVertical: 11 },
    buttonText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
    link: { color: colors.textSecondary, fontSize: 10, fontWeight: "700" },
  });
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>تعذر فتح صفحة نماذج الصور والفيديو</Text>
      <Text selectable style={styles.message}>{error.message || "حدث خطأ غير معروف أثناء فتح الصفحة."}</Text>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
        <Text style={styles.buttonText}>إعادة المحاولة دون تسجيل الخروج</Text>
      </Pressable>
      <Link href="/admin" asChild>
        <Pressable accessibilityRole="button"><Text style={styles.link}>العودة إلى لوحة التحكم</Text></Pressable>
      </Link>
    </View>
  );
}

export default MediaModelsCatalogScreen;
