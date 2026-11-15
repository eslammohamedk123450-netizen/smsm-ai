import { supabase } from "../../lib/supabase/client";

export type SulyProject = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon_key: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectInput = {
  name: string;
  description?: string | null;
  color?: string;
  iconKey?: string;
};

const PROJECT_ICONS = ["folder","code","briefcase","book","lightbulb","palette","rocket","database","globe"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeProjectInput(input: ProjectInput): {
  name: string;
  description: string | null;
  color: string;
  icon_key: string;
} {
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  const color = input.color?.trim() || "#D4AF37";
  const iconKey = input.iconKey?.trim() || "folder";
  if (!name || name.length > 100) throw new Error("اسم المشروع يجب أن يكون بين حرف واحد و100 حرف.");
  if (description && description.length > 2000) throw new Error("وصف المشروع طويل جدًا.");
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("لون المشروع غير صالح.");
  if (!(PROJECT_ICONS as readonly string[]).includes(iconKey)) throw new Error("أيقونة المشروع غير مدعومة.");
  return { name, description, color, icon_key: iconKey };
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("سجّل الدخول لإدارة مشاريعك.");
  return data.user.id;
}

export const projectService = {
  async listProjects(includeArchived = false): Promise<SulyProject[]> {
    const userId = await currentUserId();
    let query = supabase.from("suly_projects")
      .select("id,user_id,name,description,color,icon_key,archived_at,created_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    query = includeArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
    const { data, error } = await query;
    if (error) throw new Error("تعذر تحميل المشاريع.");
    return (data ?? []) as SulyProject[];
  },

  async createProject(input: ProjectInput): Promise<SulyProject> {
    const userId = await currentUserId();
    const normalized = normalizeProjectInput(input);
    const { data, error } = await supabase.from("suly_projects")
      .insert({ user_id: userId, ...normalized })
      .select("id,user_id,name,description,color,icon_key,archived_at,created_at,updated_at")
      .single();
    if (error || !data) throw new Error("تعذر إنشاء المشروع.");
    return data as SulyProject;
  },

  async updateProject(projectId: string, input: ProjectInput): Promise<void> {
    if (!UUID_PATTERN.test(projectId)) throw new Error("معرّف المشروع غير صالح.");
    const userId = await currentUserId();
    const normalized = normalizeProjectInput(input);
    const { data, error } = await supabase.from("suly_projects")
      .update(normalized)
      .eq("id", projectId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error || !data) throw new Error("تعذر تحديث المشروع أو أنه لم يعد متاحًا.");
  },

  async setArchived(projectId: string, archived: boolean): Promise<void> {
    if (!UUID_PATTERN.test(projectId)) throw new Error("معرّف المشروع غير صالح.");
    const userId = await currentUserId();
    const { data, error } = await supabase.from("suly_projects")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", projectId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error || !data) throw new Error("تعذر تحديث أرشيف المشروع.");
  },

  async assignConversation(conversationId: string, projectId: string | null): Promise<void> {
    if (!UUID_PATTERN.test(conversationId) || (projectId !== null && !UUID_PATTERN.test(projectId))) {
      throw new Error("معرّف المحادثة أو المشروع غير صالح.");
    }
    const userId = await currentUserId();
    const { data, error } = await supabase.from("suly_conversations")
      .update({ project_id: projectId })
      .eq("id", conversationId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error || !data) throw new Error("تعذر نقل المحادثة إلى المشروع المحدد.");
  },
};
