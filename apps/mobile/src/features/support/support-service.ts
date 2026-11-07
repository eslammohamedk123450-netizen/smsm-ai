import { supabase } from "../../lib/supabase/client";
import { getMediaDeliveryUrl } from "../media/media-service";

export type TicketStatus = "new" | "in_progress" | "waiting_user" | "resolved" | "closed";
export type TicketCategory = "bug" | "account" | "billing" | "content" | "other";
export interface SupportTicket {
  id: string; user_id: string; subject: string; category: TicketCategory; description: string;
  status: TicketStatus; priority: "low" | "normal" | "high"; created_at: string; updated_at: string; resolved_at: string | null;
}
export interface SupportReply { id: string; ticket_id: string; sender_id: string; is_admin_reply: boolean; body: string; created_at: string; }
export interface SupportAttachment { id: string; original_filename: string | null; mime_type: string | null; size_bytes: number; url: string; }

async function requireAdmin() {
  const { data, error } = await supabase.rpc("suly_is_admin");
  if (error || data !== true) throw new Error("يتطلب هذا الإجراء صلاحية مشرف.");
}
export const supportService = {
  async listMyTickets(): Promise<SupportTicket[]> {
    const { data, error } = await supabase.from("suly_support_tickets")
      .select("id,user_id,subject,category,description,status,priority,created_at,updated_at,resolved_at")
      .order("updated_at", { ascending: false }).limit(50);
    if (error) throw new Error("تعذر تحميل طلبات الدعم.");
    return (data ?? []) as SupportTicket[];
  },
  async createTicket(input: { subject: string; category: TicketCategory; description: string }): Promise<SupportTicket> {
    const { data, error } = await supabase.from("suly_support_tickets")
      .insert({ subject: input.subject.trim(), category: input.category, description: input.description.trim() })
      .select("id,user_id,subject,category,description,status,priority,created_at,updated_at,resolved_at").single();
    if (error || !data) throw new Error("تعذر إرسال طلب الدعم.");
    return data as SupportTicket;
  },
  async listReplies(ticketId: string): Promise<SupportReply[]> {
    const { data, error } = await supabase.from("suly_support_replies")
      .select("id,ticket_id,sender_id,is_admin_reply,body,created_at").eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }).limit(100);
    if (error) throw new Error("تعذر تحميل ردود الطلب.");
    return (data ?? []) as SupportReply[];
  },
  async reply(ticketId: string, body: string, isAdmin = false): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("سجّل الدخول مجددًا.");
    const { error } = await supabase.from("suly_support_replies").insert({ ticket_id: ticketId, sender_id: user.id, is_admin_reply: isAdmin, body: body.trim() });
    if (error) throw new Error("تعذر إرسال الرد.");
    if (isAdmin) await this.updateTicket(ticketId, "in_progress");
    else await supabase.from("suly_support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);
  },
  async attachments(ticketId: string): Promise<SupportAttachment[]> {
    const { data, error } = await supabase.from("global_media_assets")
      .select("id,original_filename,mime_type,size_bytes").eq("support_ticket_id", ticketId)
      .order("created_at", { ascending: true }).limit(20);
    if (error) throw new Error("تعذر تحميل مرفقات طلب الدعم.");
    return Promise.all((data ?? []).map(async (item) => ({
      id: String(item.id), original_filename: item.original_filename, mime_type: item.mime_type,
      size_bytes: Number(item.size_bytes ?? 0), url: await getMediaDeliveryUrl(String(item.id)),
    })));
  },
  async adminListTickets(): Promise<SupportTicket[]> {
    await requireAdmin();
    const { data, error } = await supabase.from("suly_support_tickets")
      .select("id,user_id,subject,category,description,status,priority,created_at,updated_at,resolved_at")
      .order("updated_at", { ascending: false }).limit(200);
    if (error) throw new Error("تعذر تحميل صندوق الدعم.");
    return (data ?? []) as SupportTicket[];
  },
  async updateTicket(ticketId: string, status: TicketStatus, priority?: SupportTicket["priority"]): Promise<void> {
    await requireAdmin();
    const { error } = await supabase.from("suly_support_tickets").update({
      status, ...(priority ? { priority } : {}), updated_at: new Date().toISOString(),
      resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null,
    }).eq("id", ticketId);
    if (error) throw new Error("تعذر تحديث حالة الطلب.");
  },
  async adminFrictionSummary(days = 30) {
    await requireAdmin();
    const { data, error } = await supabase.rpc("suly_admin_friction_summary", { p_days: days });
    if (error) throw new Error("تعذر تحميل مؤشرات التعثر.");
    return data ?? [];
  },
  async adminFeedbackSummary(days = 30) {
    await requireAdmin();
    const { data, error } = await supabase.rpc("suly_admin_feedback_summary", { p_days: days });
    if (error) throw new Error("تعذر تحميل ملخص التقييمات.");
    return data ?? [];
  },
};
