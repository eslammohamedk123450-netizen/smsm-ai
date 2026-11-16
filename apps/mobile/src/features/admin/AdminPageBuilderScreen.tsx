import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";

type ComponentType = "text" | "notice" | "metric" | "status" | "list" | "table";
type DataSource = "none" | "system_health_summary" | "model_catalog_summary" | "admin_activity_summary";
type BuilderComponent = {
  id: string;
  type: ComponentType;
  title: string;
  content: string;
  label: string;
  value: string;
  source: DataSource;
  items: string[];
  columns: string[];
  rows: string[][];
};
type CustomPage = {
  id: string;
  page_key: string;
  title: string;
  config: { components: BuilderComponent[] };
  status: "draft" | "published" | "hidden";
  version: number;
  updated_at: string;
};
type PageVersion = { id: string; version: number; title: string; status: string; change_note: string | null; created_at: string };

const TYPES: Array<{ value: ComponentType; ar: string; en: string }> = [
  { value: "text", ar: "نص", en: "Text" },
  { value: "notice", ar: "تنبيه", en: "Notice" },
  { value: "metric", ar: "بطاقة رقمية", en: "Metric card" },
  { value: "status", ar: "حالة", en: "Status" },
  { value: "list", ar: "قائمة", en: "List" },
  { value: "table", ar: "جدول", en: "Table" },
];
const SOURCES: Array<{ value: DataSource; ar: string; en: string }> = [
  { value: "none", ar: "بدون مصدر بيانات", en: "No data source" },
  { value: "system_health_summary", ar: "ملخص صحة النظام", en: "System health summary" },
  { value: "model_catalog_summary", ar: "ملخص كتالوج النماذج", en: "Model catalogue summary" },
  { value: "admin_activity_summary", ar: "ملخص نشاط الإدارة", en: "Admin activity summary" },
];
const makeComponent = (type: ComponentType): BuilderComponent => ({
  id: `component-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type, title: "", content: "", label: "", value: "", source: "none",
  items: [], columns: ["العمود 1", "العمود 2"], rows: [["قيمة 1", "قيمة 2"]],
});

function formatAdminSource(source: string, data: unknown, isArabic: boolean): string {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "—";
  const row = data as Record<string, unknown>;
  const number = (key: string) => typeof row[key] === "number"
    ? (row[key] as number).toLocaleString(isArabic ? "ar-EG" : "en-US")
    : "—";
  const lines: string[] = [];
  if (source === "system_health_summary") {
    lines.push((isArabic ? "النماذج المفعلة" : "Enabled models") + ": " + number("enabled_models"));
    lines.push((isArabic ? "نماذج سليمة" : "Healthy enabled models") + ": " + number("healthy_enabled_models"));
    lines.push((isArabic ? "نماذج مقيدة" : "Restricted models") + ": " + number("restricted_models"));
  } else if (source === "model_catalog_summary") {
    lines.push((isArabic ? "المزودون المفعّلون" : "Enabled providers") + ": " + number("enabled_providers"));
    lines.push((isArabic ? "النماذج المفعلة" : "Enabled models") + ": " + number("enabled_models"));
    lines.push((isArabic ? "النماذج المعطلة" : "Disabled models") + ": " + number("disabled_models"));
  } else if (source === "admin_activity_summary") {
    lines.push((isArabic ? "الأحداث خلال 24 ساعة" : "Events in the last 24 hours") + ": " + number("events_last_24h"));
    const actions = Array.isArray(row.latest_actions) ? row.latest_actions.slice(0, 5) : [];
    for (const item of actions) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const action = (item as Record<string, unknown>).action;
      const createdAt = (item as Record<string, unknown>).created_at;
      const date = typeof createdAt === "string" && !Number.isNaN(Date.parse(createdAt))
        ? new Date(createdAt).toLocaleString(isArabic ? "ar-EG" : "en-US") : "—";
      if (typeof action === "string") lines.push("• " + action + " · " + date);
    }
  }
  return lines.length ? lines.join("\n") : (isArabic ? "لا توجد بيانات متاحة." : "No data available.");
}
export function AdminPageBuilderScreen() {
  const router = useRouter();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageKey, setPageKey] = useState("");
  const [title, setTitle] = useState("");
  const [components, setComponents] = useState<BuilderComponent[]>([]);
  const [changeNote, setChangeNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [sourceSnapshots, setSourceSnapshots] = useState<Record<string, string>>({});

  const t = (ar: string, en: string) => isArabic ? ar : en;
  const loadPages = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("suly_admin_list_custom_pages");
      if (rpcError) throw rpcError;
      const rows = Array.isArray(data) ? data as CustomPage[] : [];
      setPages(rows);
      if (selectedId) {
        const current = rows.find((row) => row.id === selectedId);
        if (current) {
          setTitle(current.title);
          setPageKey(current.page_key);
          setComponents((current.config?.components ?? []).map((component, index) => ({ ...component, id: component.id ?? `saved-${index}` })));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("تعذر تحميل الصفحات. تأكد من نشر Migration الخاص بالمنشئ.","Could not load pages. Confirm the builder migration is deployed."));
    } finally { setLoading(false); }
  }, [selectedId, isArabic]);
  useEffect(() => { void loadPages(); }, [loadPages]);

  const selectPage = async (page: CustomPage) => {
    setSelectedId(page.id); setPageKey(page.page_key); setTitle(page.title);
    setComponents((page.config?.components ?? []).map((component, index) => ({ ...component, id: component.id ?? `saved-${index}` }))); setPreview(false); setMessage("");
    const { data, error: rpcError } = await supabase.rpc("suly_admin_list_custom_page_versions", { p_page_id: page.id });
    if (rpcError) { setError(rpcError.message); setVersions([]); }
    else setVersions(Array.isArray(data) ? data as PageVersion[] : []);
  };
  const newPage = () => {
    setSelectedId(null); setPageKey(""); setTitle(""); setComponents([]);
    setVersions([]); setChangeNote(""); setPreview(false); setError(""); setMessage("");
  };
  const updateComponent = (id: string, patch: Partial<BuilderComponent>) => {
    setComponents((current) => current.map((component) => component.id === id ? { ...component, ...patch } : component));
  };
  const save = async (status: "draft" | "published") => {
    setSaving(true); setError(""); setMessage("");
    try {
      const cleanKey = pageKey.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(cleanKey)) throw new Error(t("استخدم مفتاحًا إنجليزيًا من 2 إلى 48 حرفًا/رقمًا وشرطة.","Use a 2–48 character key with lowercase letters, numbers and hyphens."));
      if (title.trim().length < 2) throw new Error(t("عنوان الصفحة مطلوب.","Page title is required."));
      if (!components.length) throw new Error(t("أضف مكونًا واحدًا على الأقل.","Add at least one component."));
      const config = { components: components.map(({ id, ...component }) => component) };
      const { data, error: rpcError } = await supabase.rpc("suly_admin_save_custom_page", {
        p_page_id: selectedId, p_page_key: cleanKey, p_title: title.trim(), p_config: config,
        p_status: status, p_change_note: changeNote.trim() || null,
      });
      if (rpcError) throw rpcError;
      if (!data?.success || typeof data.id !== "string") throw new Error(t("لم تؤكد قاعدة البيانات الحفظ.","The database did not confirm the save."));
      setSelectedId(data.id);
      setMessage(t(`تم حفظ الإصدار ${data.version}.`, `Version ${data.version} saved.`));
      await loadPages();
      const { data: versionData } = await supabase.rpc("suly_admin_list_custom_page_versions", { p_page_id: data.id });
      setVersions(Array.isArray(versionData) ? versionData as PageVersion[] : []);
    } catch (e) { setError(e instanceof Error ? e.message : t("فشل الحفظ.","Save failed.")); }
    finally { setSaving(false); }
  };
  const restore = async (version: number) => {
    setSaving(true); setError(""); setMessage("");
    try {
      const { data, error: rpcError } = await supabase.rpc("suly_admin_restore_custom_page_version", { p_page_id: selectedId, p_version: version });
      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(t("لم يتم تأكيد الاسترجاع.","Restore was not confirmed."));
      setMessage(t(`تم إنشاء مسودة من الإصدار ${version}.`, `A draft was restored from version ${version}.`));
      await loadPages();
      const { data: versionData } = await supabase.rpc("suly_admin_list_custom_page_versions", { p_page_id: selectedId });
      setVersions(Array.isArray(versionData) ? versionData as PageVersion[] : []);
    } catch (e) { setError(e instanceof Error ? e.message : t("فشل الاسترجاع.","Restore failed.")); }
    finally { setSaving(false); }
  };

  useEffect(() => {\n    if (!preview) return;\n    let active = true;\n    const sources = [...new Set(components.map((item) => item.source).filter((source) => source !== "none"))];\n    void Promise.all(sources.map(async (source) => {\n      const { data, error: rpcError } = await supabase.rpc("suly_admin_custom_page_source", { p_source: source });\n      return [source, rpcError ? t("مصدر البيانات غير متاح", "Data source unavailable") : formatAdminSource(source, data, isArabic)] as const;\n    })).then((entries) => { if (active) setSourceSnapshots(Object.fromEntries(entries)); });\n    return () => { active = false; };\n  }, [preview, components, isArabic]);\n\n  const renderPreviewComponent = (component: BuilderComponent) => (
    <View key={component.id} style={styles.previewComponent}>
      <Text style={styles.componentTitle}>{component.title || t("مكون بدون عنوان","Untitled component")}</Text>
      {component.type === "metric" ? <Text style={styles.metricValue}>{component.value || "—"}</Text> : null}
      {component.content ? <Text style={styles.bodyText}>{component.content}</Text> : null}
      {component.type === "status" ? <Text style={styles.statusText}>{component.label || t("غير محدد","Unspecified")}</Text> : null}
      {component.type === "list" ? component.items.map((item, index) => <Text key={index} style={styles.bodyText}>• {item}</Text>) : null}
      {component.type === "table" ? <View style={styles.previewTable}><Text style={styles.bodyText}>{(component.columns ?? []).join("  |  ")}</Text>{(component.rows ?? []).map((row, index) => <Text key={index} style={styles.bodyText}>{row.join("  |  ")}</Text>)}</View> : null}
      {component.source !== "none" ? <Text style={styles.sourceTag}>{t("بيانات المصدر: ","Source data: ")}{sourceSnapshots[component.source] ?? t("جارٍ التحميل…","Loading…")}</Text> : null}
    </View>
  );

  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.heading}>{t("منشئ صفحات الإدارة","Admin page builder")}</Text>
        <Text style={styles.subheading}>{t("إنشاء صفحات مخصصة بمكونات مسموحة ومصادر بيانات إدارية حية محددة.","Build custom pages with approved components and allowlisted live admin data sources.")}</Text>
      </View>
      <Pressable onPress={newPage} style={styles.outlineButton}><Text style={styles.outlineButtonText}>{t("صفحة جديدة","+ New page")}</Text></Pressable>
    </View>
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{t("الحماية: لا يوجد SQL أو RPC حر. الخادم يتحقق من قائمة المكونات ومصادر البيانات الثلاثة المتصلة للقراءة فقط. الأقسام الأساسية مثل الأمان والمحاسبة وHIMS خارج نطاق التعديل.","Safety: no arbitrary SQL or RPC. Components and the three connected read-only data sources are validated server-side. Core security, finance and HIMS sections are outside this builder's scope.")}</Text>
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {message ? <Text style={styles.success}>{message}</Text> : null}
    <View style={styles.layout}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{t("الصفحات المحفوظة","Saved pages")}</Text>
        {loading ? <ActivityIndicator color={colors.primary} /> : pages.length ? pages.map((page) => <View key={page.id} style={[styles.pageRow, selectedId === page.id && styles.pageRowActive]}>
          <Pressable onPress={() => void selectPage(page)} style={styles.pageSelect}>
            <Text style={styles.pageRowTitle}>{page.title}</Text>
            <Text style={styles.pageRowMeta}>{page.page_key} · v{page.version} · {page.status}</Text>
          </Pressable>
          {page.status === "published" ? <Pressable onPress={() => router.push({ pathname: "/admin/custom/[pageKey]", params: { pageKey: page.page_key } })} style={styles.outlineButton}><Text style={styles.outlineButtonText}>{t("فتح","Open")}</Text></Pressable> : null}
        </View>) : <Text style={styles.hint}>{t("لا توجد صفحات مخصصة بعد.","No custom pages yet.")}</Text>}
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{t("محرر الصفحة","Page editor")}</Text>
        <Text style={styles.label}>{t("مفتاح الصفحة (إنجليزي)","Page key (English)")}</Text>
        <TextInput value={pageKey} onChangeText={setPageKey} editable={!saving} placeholder="operations-summary" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.input} />
        <Text style={styles.label}>{t("عنوان الصفحة","Page title")}</Text>
        <TextInput value={title} onChangeText={setTitle} editable={!saving} style={styles.input} placeholder={t("مثال: متابعة التشغيل","e.g. Operations summary")} placeholderTextColor={colors.textMuted} />
        <View style={styles.sectionHeading}>
          <Text style={styles.panelTitle}>{t("المكونات","Components")} ({components.length}/20)</Text>
          <View style={styles.typeButtons}>{TYPES.map((type) => <Pressable key={type.value} disabled={saving || components.length >= 20} onPress={() => setComponents((current) => [...current, makeComponent(type.value)])} style={styles.chip}><Text style={styles.chipText}>{isArabic ? type.ar : type.en}</Text></Pressable>)}</View>
        </View>
        {components.map((component, index) => <View key={component.id} style={styles.componentEditor}>
          <View style={styles.sectionHeading}>
            <Text style={styles.componentTitle}>{index + 1}. {TYPES.find((type) => type.value === component.type)?.[isArabic ? "ar" : "en"]}</Text>
            <View style={styles.actionRow}>
              <Pressable disabled={index === 0} onPress={() => setComponents((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}><Text style={styles.outlineButtonText}>↑</Text></Pressable>
              <Pressable disabled={index === components.length - 1} onPress={() => setComponents((current) => { const next = [...current]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}><Text style={styles.outlineButtonText}>↓</Text></Pressable>
              <Pressable onPress={() => setComponents((current) => current.filter((item) => item.id !== component.id))}><Text style={styles.removeText}>{t("حذف","Remove")}</Text></Pressable>
            </View>
          </View>
          <TextInput value={component.title} onChangeText={(value) => updateComponent(component.id, { title: value })} style={styles.input} placeholder={t("عنوان المكون","Component title")} placeholderTextColor={colors.textMuted} />
          {component.type === "metric" ? <TextInput value={component.value} onChangeText={(value) => updateComponent(component.id, { value })} style={styles.input} placeholder={t("القيمة الرقمية","Metric value")} placeholderTextColor={colors.textMuted} /> : null}
          {component.type === "status" ? <TextInput value={component.label} onChangeText={(value) => updateComponent(component.id, { label: value })} style={styles.input} placeholder={t("وصف الحالة","Status label")} placeholderTextColor={colors.textMuted} /> : null}
          {component.type === "text" || component.type === "notice" ? <TextInput value={component.content} onChangeText={(value) => updateComponent(component.id, { content: value })} style={[styles.input, styles.multiline]} multiline placeholder={t("المحتوى","Content")} placeholderTextColor={colors.textMuted} /> : null}
          {component.type === "list" ? <TextInput value={component.items.join("\n")} onChangeText={(value) => updateComponent(component.id, { items: value.split("\n").map((item) => item.trim()).filter(Boolean).slice(0,20) })} style={[styles.input, styles.multiline]} multiline placeholder={t("عنصر واحد في كل سطر","One item per line")} placeholderTextColor={colors.textMuted} /> : null}
          {component.type === "table" ? <><TextInput value={component.columns.join(" | ")} onChangeText={(value) => updateComponent(component.id, { columns: value.split("|").slice(0,8).map((cell) => cell.trim()) })} style={styles.input} placeholder={t("عناوين الأعمدة وافصل بينها |","Column headings separated by |")} placeholderTextColor={colors.textMuted} /><TextInput value={component.rows.map((row) => row.join(" | ")).join("\n")} onChangeText={(value) => updateComponent(component.id, { rows: value.split("\n").slice(0,20).map((line) => line.split("|").slice(0,8).map((cell) => cell.trim())) })} style={[styles.input, styles.multiline]} multiline placeholder={t("صف واحد في كل سطر، افصل الخلايا بعلامة |","One row per line; separate cells with |")} placeholderTextColor={colors.textMuted} /></> : null}
          <Text style={styles.label}>{t("مصدر البيانات","Data source")}</Text>
          <View style={styles.typeButtons}>{SOURCES.map((source) => <Pressable key={source.value} onPress={() => updateComponent(component.id, { source: source.value })} style={[styles.chip, component.source === source.value && styles.chipActive]}><Text style={styles.chipText}>{isArabic ? source.ar : source.en}</Text></Pressable>)}</View>
        </View>)}
        <TextInput value={changeNote} onChangeText={setChangeNote} style={styles.input} placeholder={t("ملاحظة الإصدار (اختياري)","Version note (optional)")} placeholderTextColor={colors.textMuted} />
        <View style={styles.actionRow}>
          <Pressable disabled={saving} onPress={() => void save("draft")} style={[styles.primaryButton, saving && styles.disabled]}><Text style={styles.primaryButtonText}>{saving ? t("جارٍ الحفظ…","Saving…") : t("حفظ كمسودة","Save draft")}</Text></Pressable>
          <Pressable disabled={saving} onPress={() => void save("published")} style={[styles.primaryButton, saving && styles.disabled]}><Text style={styles.primaryButtonText}>{t("نشر الصفحة","Publish page")}</Text></Pressable>
          <Pressable disabled={saving || !selectedId} onPress={() => void save("hidden")} style={[styles.outlineButton, (!selectedId || saving) && styles.disabled]}><Text style={styles.outlineButtonText}>{t("إخفاء الصفحة","Hide page")}</Text></Pressable>
          <Pressable onPress={() => setPreview((value) => !value)} style={styles.outlineButton}><Text style={styles.outlineButtonText}>{preview ? t("إخفاء المعاينة","Hide preview") : t("معاينة","Preview")}</Text></Pressable>
        </View>
      </View>
    </View>
    {preview ? <View style={styles.panel}><Text style={styles.panelTitle}>{t("معاينة الصفحة","Page preview")}: {title}</Text>{components.map(renderPreviewComponent)}</View> : null}
    {selectedId ? <View style={styles.panel}>
      <Text style={styles.panelTitle}>{t("سجل الإصدارات","Version history")}</Text>
      {versions.map((version) => <View key={version.id} style={styles.versionRow}>
        <View style={styles.versionCopy}><Text style={styles.pageRowTitle}>v{version.version} · {version.status}</Text><Text style={styles.pageRowMeta}>{version.change_note || version.created_at}</Text></View>
        <Pressable disabled={saving || version.version === pages.find((page) => page.id === selectedId)?.version} onPress={() => void restore(version.version)} style={styles.outlineButton}><Text style={styles.outlineButtonText}>{t("استرجاع كمسودة","Restore draft")}</Text></Pressable>
      </View>)}
    </View> : null}
  </ScrollView>;
}

function createStyles(colors: ThemePalette, isArabic: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, gap: 14, maxWidth: 1200, width: "100%", alignSelf: "center" },
    header: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
    headerCopy: { flex: 1, gap: 4 }, heading: { color: colors.textPrimary, fontSize: 21, fontWeight: "900", textAlign: isArabic ? "right" : "left" },
    subheading: { color: colors.textMuted, fontSize: 12, textAlign: isArabic ? "right" : "left" },
    notice: { borderWidth: 1, borderColor: colors.divider, borderRadius: 10, backgroundColor: colors.surface, padding: 12 },
    noticeText: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, textAlign: isArabic ? "right" : "left" },
    error: { color: colors.error, textAlign: isArabic ? "right" : "left" }, success: { color: colors.success, textAlign: isArabic ? "right" : "left" },
    layout: { gap: 14 }, panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 14, gap: 10 },
    panelTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
    label: { color: colors.textSecondary, fontSize: 11, textAlign: isArabic ? "right" : "left" },
    input: { minHeight: 42, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary, borderRadius: 8, paddingHorizontal: 10, textAlign: isArabic ? "right" : "left" },
    multiline: { minHeight: 86, textAlignVertical: "top", paddingTop: 10 },
    pageRow: { borderWidth: 1, borderColor: colors.divider, borderRadius: 8, padding: 10, gap: 7 }, pageSelect: { gap: 3 },
    pageRowActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
    pageRowTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: "700", textAlign: isArabic ? "right" : "left" },
    pageRowMeta: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left" },
    hint: { color: colors.textMuted, fontSize: 11, textAlign: isArabic ? "right" : "left" },
    sectionHeading: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
    typeButtons: { flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 6 },
    chip: { borderWidth: 1, borderColor: colors.divider, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
    chipText: { color: colors.textSecondary, fontSize: 10 },
    componentEditor: { borderWidth: 1, borderColor: colors.divider, borderRadius: 9, padding: 10, gap: 8 },
    componentTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
    removeText: { color: colors.error, fontSize: 11, fontWeight: "700" },
    actionRow: { flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 8 },
    primaryButton: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 10 },
    primaryButtonText: { color: colors.onPrimary, fontSize: 11, fontWeight: "800" },
    outlineButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
    outlineButtonText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
    disabled: { opacity: 0.5 },
    previewTable: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 7, gap: 5 },\n    previewComponent: { borderWidth: 1, borderColor: colors.divider, borderRadius: 9, padding: 12, gap: 7, backgroundColor: colors.background },
    metricValue: { color: colors.primary, fontSize: 26, fontWeight: "900" },
    bodyText: { color: colors.textSecondary, fontSize: 12, lineHeight: 19 },
    statusText: { color: colors.success, fontSize: 12, fontWeight: "700" },
    sourceTag: { color: colors.textMuted, fontSize: 10 },
    versionRow: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 9 },
    versionCopy: { flex: 1, gap: 3 },
  });
}
