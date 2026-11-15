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

import { normalizeProjectInput, type ProjectInput } from "./project-validation";

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
