import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";

type Component = { id?: string; type: string; title?: string; content?: string; label?: string; value?: string; source?: string; items?: string[]; columns?: string[]; rows?: string[][] };
type Page = { page_key: string; title: string; status: string; config: { components: Component[] } };

export function AdminCustomPageScreen() {
  const { pageKey } = useLocalSearchParams<{ pageKey: string }>();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [page, setPage] = useState<Page | null>(null);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const t = (ar: string, en: string) => isArabic ? ar : en;

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true); setError("");
      try {
        const { data, error: rpcError } = await supabase.rpc("suly_admin_list_custom_pages");
        if (rpcError) throw rpcError;
        const rows = Array.isArray(data) ? data as Page[] : [];
        const found = rows.find((row) => row.page_key === pageKey && row.status === "published");
        if (!found) throw new Error(t("الصفحة غير موجودة أو غير منشورة.","Page not found or not published."));
        if (active) setPage(found);
        const keys = [...new Set((found.config?.components ?? []).map((component) => component.source).filter((source): source is string => Boolean(source && source !== "none")))];
        const entries = await Promise.all(keys.map(async (source) => {
          const { data: sourceData, error: sourceError } = await supabase.rpc("suly_admin_custom_page_source", { p_source: source });
          return [source, sourceError ? t("مصدر البيانات غير متاح","Data source unavailable") : JSON.stringify(sourceData, null, 2)] as const;
        }));
        if (active) setSources(Object.fromEntries(entries));
      } catch (e) { if (active) setError(e instanceof Error ? e.message : t("تعذر تحميل الصفحة.","Could not load page.")); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [pageKey, isArabic]);

  const renderComponent = (component: Component, index: number) => <View key={component.id ?? index} style={styles.card}>
    {component.title ? <Text style={styles.cardTitle}>{component.title}</Text> : null}
    {component.type === "metric" ? <Text style={styles.metric}>{component.value || "—"}</Text> : null}
    {component.content ? <Text style={styles.body}>{component.content}</Text> : null}
    {component.type === "status" ? <Text style={styles.status}>{component.label || "—"}</Text> : null}
    {component.type === "list" ? (component.items ?? []).map((item, itemIndex) => <Text key={itemIndex} style={styles.body}>• {item}</Text>) : null}
    {component.type === "table" ? <View style={styles.table}>{(component.rows ?? []).map((row, rowIndex) => <Text key={rowIndex} style={styles.body}>{row.join("  |  ")}</Text>)}</View> : null}
    {component.source && component.source !== "none" ? <Text style={styles.source}>{sources[component.source] ?? t("جارٍ تحميل المصدر…","Loading source…")}</Text> : null}
  </View>;

  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <Text style={styles.heading}>{page?.title ?? t("صفحة الإدارة","Admin page")}</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : page?.config.components.map(renderComponent)}
  </ScrollView>;
}

function createStyles(colors: ThemePalette, isArabic: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 12, maxWidth: 1100, width: "100%", alignSelf: "center" },
    heading: { color: colors.textPrimary, fontSize: 22, fontWeight: "900", textAlign: isArabic ? "right" : "left" },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 14, gap: 8 },
    cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
    metric: { color: colors.primary, fontSize: 28, fontWeight: "900", textAlign: isArabic ? "right" : "left" },
    body: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, textAlign: isArabic ? "right" : "left" },
    status: { color: colors.success, fontSize: 13, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
    source: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left" },
    table: { gap: 5, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 },
    error: { color: colors.error, textAlign: isArabic ? "right" : "left" },
  });
}
