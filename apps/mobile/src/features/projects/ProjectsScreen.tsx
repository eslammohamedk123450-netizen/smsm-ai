import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useToast } from "../../components/ui/Toast";
import { projectService, type SulyProject } from "./project-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import { useAppLocale } from "../../theme/LocaleProvider";
import type { ThemePalette } from "../../theme/colors";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  folder: "folder-outline", code: "code-slash-outline", briefcase: "briefcase-outline",
  book: "book-outline", lightbulb: "bulb-outline", palette: "color-palette-outline",
  rocket: "rocket-outline", database: "server-outline", globe: "globe-outline",
};

export default function ProjectsScreen() {
  const router = useRouter();
  const { show } = useToast();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [projects, setProjects] = useState<SulyProject[]>([]);
  const [archived, setArchived] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await projectService.listProjects(archived);
      setProjects(result);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : (isArabic ? "تعذر تحميل المشاريع." : "Could not load projects.");
      setLoadError(message);
      setProjects([]);
      show(message, "error");
    } finally {
      setLoading(false);
    }
  }, [archived, isArabic, show]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const create = async () => {
    if (creating || !name.trim()) return;
    setCreating(true);
    try {
      await projectService.createProject({ name, description, iconKey: "folder" });
      setName(""); setDescription("");
      await load();
      show(isArabic ? "تم إنشاء المشروع." : "Project created.", "success");
    } catch (cause) {
      show(cause instanceof Error ? cause.message : (isArabic ? "تعذر إنشاء المشروع." : "Could not create project."), "error");
    } finally { setCreating(false); }
  };

  const toggleArchive = async (project: SulyProject) => {
    if (archivingId !== null) return;
    setArchivingId(project.id);
    try {
      await projectService.setArchived(project.id, !project.archived_at);
      await load();
      show(project.archived_at ? (isArabic ? "تمت استعادة المشروع." : "Project restored.") : (isArabic ? "تمت أرشفة المشروع." : "Project archived."), "success");
    } catch (cause) {
      show(cause instanceof Error ? cause.message : (isArabic ? "تعذر تحديث المشروع." : "Could not update project."), "error");
    } finally {
      setArchivingId(null);
    }
  };

  const openProject = (project: SulyProject) => {
    router.push({ pathname: "/chat", params: { projectId: project.id } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top","bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
            <Ionicons name={isArabic ? "arrow-forward" : "arrow-back"} size={20} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{isArabic ? "مشاريعي" : "My projects"}</Text>
            <Text style={styles.subtitle}>{isArabic ? "اجمع محادثاتك ومهامك في مساحات عمل منظمة." : "Organize your chats and tasks in focused workspaces."}</Text>
          </View>
          <Ionicons name="folder-open-outline" size={27} color={colors.primary} />
        </View>

        {!archived ? (
          <View style={styles.createCard}>
            <Text style={styles.sectionTitle}>{isArabic ? "إنشاء مشروع جديد" : "Create a project"}</Text>
            <TextInput value={name} onChangeText={setName} placeholder={isArabic ? "اسم المشروع" : "Project name"}
              placeholderTextColor={colors.textMuted} maxLength={100} style={styles.input}
              textAlign={isArabic ? "right" : "left"} accessibilityLabel={isArabic ? "اسم المشروع" : "Project name"} />
            <TextInput value={description} onChangeText={setDescription}
              placeholder={isArabic ? "وصف مختصر (اختياري)" : "Short description (optional)"}
              placeholderTextColor={colors.textMuted} maxLength={2000} multiline
              style={[styles.input, styles.descriptionInput]} textAlign={isArabic ? "right" : "left"}
              accessibilityLabel={isArabic ? "وصف المشروع" : "Project description"} />
            <Pressable disabled={creating || !name.trim()} onPress={() => void create()} style={[styles.createButton, (creating || !name.trim()) && styles.disabled]}>
              {creating ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Ionicons name="add" size={19} color={colors.onPrimary} />}
              <Text style={styles.createButtonText}>{isArabic ? "إنشاء المشروع" : "Create project"}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>{archived ? (isArabic ? "المشاريع المؤرشفة" : "Archived projects") : (isArabic ? "المشاريع النشطة" : "Active projects")}</Text>
          <Pressable onPress={() => setArchived((value) => !value)} style={styles.archiveToggle}>
            <Ionicons name={archived ? "folder-open-outline" : "archive-outline"} size={16} color={colors.primary} />
            <Text style={styles.archiveToggleText}>{archived ? (isArabic ? "عرض النشطة" : "Show active") : (isArabic ? "الأرشيف" : "Archive")}</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : loadError ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={34} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{isArabic ? "تعذر تحميل المشاريع" : "Could not load projects"}</Text>
            <Text accessibilityRole="alert" style={styles.emptyText}>{loadError}</Text>
            <Pressable onPress={() => void load()} style={styles.retryButton} accessibilityRole="button">
              <Ionicons name="refresh-outline" size={17} color={colors.onPrimary} />
              <Text style={styles.retryButtonText}>{isArabic ? "إعادة المحاولة" : "Try again"}</Text>
            </Pressable>
          </View>
        ) : projects.length ? projects.map((project) => (
          <View key={project.id} style={styles.projectCard}>
            <View style={[styles.projectIcon, { borderColor: project.color }]}>
              <Ionicons name={ICONS[project.icon_key] ?? "folder-outline"} size={23} color={project.color} />
            </View>
            <View style={styles.projectCopy}>
              <Text style={styles.projectName}>{project.name}</Text>
              <Text style={styles.projectDescription}>{project.description || (isArabic ? "لا يوجد وصف للمشروع" : "No project description")}</Text>
              <Text style={styles.projectDate}>{isArabic ? "آخر تحديث: " : "Updated: "}{new Date(project.updated_at).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}</Text>
            </View>
            <View style={styles.projectActions}>
              {!archived ? (
                <Pressable onPress={() => openProject(project)} style={styles.openButton}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.onPrimary} />
                  <Text style={styles.openButtonText}>{isArabic ? "افتح" : "Open"}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => void toggleArchive(project)} disabled={archivingId !== null} style={[styles.iconButton, archivingId !== null && styles.disabled]}
                accessibilityRole="button" accessibilityState={{ disabled: archivingId !== null }} accessibilityLabel={archived ? (isArabic ? "استعادة المشروع" : "Restore project") : (isArabic ? "أرشفة المشروع" : "Archive project")}>
                {archivingId === project.id
                  ? <ActivityIndicator size="small" color={colors.textSecondary} />
                  : <Ionicons name={archived ? "refresh-outline" : "archive-outline"} size={18} color={colors.textSecondary} />}
              </Pressable>
            </View>
          </View>
        )) : (
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={34} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{archived ? (isArabic ? "لا توجد مشاريع مؤرشفة" : "No archived projects") : (isArabic ? "لسه مفيش مشاريع" : "No projects yet")}</Text>
            <Text style={styles.emptyText}>{archived ? (isArabic ? "ستظهر المشاريع التي تقوم بأرشفتها هنا." : "Archived projects will appear here.") : (isArabic ? "أنشئ مشروعك الأول وابدأ محادثة مرتبطة به." : "Create your first project and start a linked chat.")}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, gap: 16, paddingBottom: 36, maxWidth: 900, width: "100%", alignSelf: "center" },
  header: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 12, marginBottom: 4 },
  backButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  headerCopy: { flex: 1, alignItems: isArabic ? "flex-end" : "flex-start", gap: 4 },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: "800" },
  subtitle: { color: colors.textSecondary, fontSize: 12, textAlign: isArabic ? "right" : "left", lineHeight: 19 },
  createCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 18, padding: 16, gap: 10 },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, color: colors.textPrimary, paddingHorizontal: 13, paddingVertical: 12, minHeight: 46 },
  descriptionInput: { minHeight: 76, textAlignVertical: "top" },
  createButton: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 44, borderRadius: 12, backgroundColor: colors.primary },
  createButtonText: { color: colors.onPrimary, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  listHeader: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  archiveToggle: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 5, padding: 8 },
  archiveToggleText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  loader: { marginTop: 24 },
  retryButton: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 42, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.primary, marginTop: 12 },
  retryButtonText: { color: colors.onPrimary, fontWeight: "700", fontSize: 12 },
  projectCard: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 13 },
  projectIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  projectCopy: { flex: 1, alignItems: isArabic ? "flex-end" : "flex-start", gap: 4 },
  projectName: { color: colors.textPrimary, fontSize: 14, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  projectDescription: { color: colors.textSecondary, fontSize: 11, textAlign: isArabic ? "right" : "left", lineHeight: 17 },
  projectDate: { color: colors.textMuted, fontSize: 10 },
  projectActions: { alignItems: "center", gap: 8 },
  openButton: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.primary },
  openButtonText: { color: colors.onPrimary, fontSize: 11, fontWeight: "800" },
  iconButton: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  empty: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 44, borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  emptyTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  emptyText: { color: colors.textSecondary, fontSize: 12, textAlign: "center" },
});
