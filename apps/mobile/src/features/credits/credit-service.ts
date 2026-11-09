import { supabase } from "../../lib/supabase/client";

export type CreditEntry = {
  id: string;
  event_type: string;
  amount: number;
  balance_delta: number;
  balance_after: number;
  source: string;
  reason: string | null;
  created_at: string;
  hold_id: string | null;
  conversation_id: string | null;
  task_title: string | null;
  charged_amount: number | null;
};

export type TaskUsage = {
  taskId: string;
  conversationId: string;
  taskTitle: string;
  reserved: number;
  charged: number;
  status: string;
  createdAt: string;
};

export type TaskRating = { stars: number; note: string | null };

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("انتهت الجلسة. سجّل الدخول مجددًا.");
  return data.user.id;
}

export async function getCurrentCreditBalance(): Promise<number> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.from("suly_credit_accounts")
    .select("balance").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("تعذر تحميل رصيدك الحالي.");
  return Number(data?.balance ?? 0);
}

export async function getMonthlyCreditUsage(): Promise<number> {
  const userId = await getCurrentUserId();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const pageSize = 500;
  let offset = 0;
  let total = 0;

  while (true) {
    const { data, error } = await supabase.from("suly_credit_transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("event_type", "settle")
      .gte("created_at", monthStart)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("تعذر تحميل استهلاك هذا الشهر.");
    const rows = data ?? [];
    total += rows.reduce((sum, row) => sum + Math.max(0, Number(row.amount) || 0), 0);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return total;
}

export async function getCreditLedger(limit = 50): Promise<{ balance: number; entries: CreditEntry[] }> {
  const userId = await getCurrentUserId();
  const [{ data: account, error: accountError }, { data: transactions, error: transactionError }] = await Promise.all([
    supabase.from("suly_credit_accounts").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.from("suly_credit_transactions")
      .select("id,event_type,amount,balance_delta,balance_after,source,reason,created_at,hold_id")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(Math.min(Math.max(limit, 1), 100)),
  ]);
  if (accountError || transactionError) throw new Error("تعذر تحميل رصيدك وسجل الاستهلاك.");
  const holdIds = [...new Set((transactions ?? []).map((row) => row.hold_id).filter((id): id is string => typeof id === "string"))];
  const holds = holdIds.length
    ? await supabase.from("suly_credit_holds").select("task_id,conversation_id,charged_amount,reserved_amount,status").eq("user_id", userId).in("task_id", holdIds).limit(100)
    : { data: [], error: null };
  if (holds.error) throw new Error("تعذر ربط سجل الرصيد بمهامه.");
  const holdById = new Map((holds.data ?? []).map((hold) => [String(hold.task_id), hold]));
  const conversationIds = [...new Set((holds.data ?? []).map((hold) => hold.conversation_id).filter((id): id is string => typeof id === "string"))];
  const conversations = conversationIds.length
    ? await supabase.from("suly_conversations").select("id,title").in("id", conversationIds).limit(100)
    : { data: [], error: null };
  if (conversations.error) throw new Error("تعذر تحميل أسماء المهام.");
  const titleByConversation = new Map((conversations.data ?? []).map((row) => [String(row.id), String(row.title || "مهمة بدون عنوان")]));
  return {
    balance: Number(account?.balance ?? 0),
    entries: (transactions ?? []).map((row) => {
      const hold = row.hold_id ? holdById.get(String(row.hold_id)) : null;
      return { ...row, amount: Number(row.amount), balance_delta: Number(row.balance_delta), balance_after: Number(row.balance_after), hold_id: row.hold_id ? String(row.hold_id) : null, conversation_id: hold?.conversation_id ? String(hold.conversation_id) : null, task_title: hold?.conversation_id ? titleByConversation.get(String(hold.conversation_id)) ?? "مهمة بدون عنوان" : null, charged_amount: hold?.charged_amount == null ? null : Number(hold.charged_amount) };
    }) as CreditEntry[],
  };
}

export async function getTaskUsage(conversationId: string): Promise<TaskUsage | null> {
  const { data, error } = await supabase.from("suly_credit_holds")
    .select("task_id,conversation_id,reserved_amount,charged_amount,status,created_at")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("تعذر تحميل استهلاك المهمة الحالية.");
  if (!data) return null;
  const { data: conversation } = await supabase.from("suly_conversations").select("title").eq("id", conversationId).maybeSingle();
  return { taskId: String(data.task_id), conversationId, taskTitle: String(conversation?.title || "المهمة الحالية"), reserved: Number(data.reserved_amount ?? 0), charged: Number(data.charged_amount ?? 0), status: String(data.status), createdAt: String(data.created_at) };
}

export async function getTaskRating(conversationId: string): Promise<TaskRating | null> {
  const { data, error } = await supabase.from("suly_task_ratings").select("stars,note").eq("conversation_id", conversationId).maybeSingle();
  if (error) throw new Error("تعذر تحميل تقييم المهمة.");
  return data ? { stars: Number(data.stars), note: data.note ? String(data.note) : null } : null;
}

export async function saveTaskRating(input: { conversationId: string; taskId?: string | null; stars: number; note?: string }): Promise<void> {
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) throw new Error("اختر تقييمًا من نجمة إلى خمس نجوم.");
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("انتهت الجلسة. سجّل الدخول مجددًا.");
  const { error } = await supabase.from("suly_task_ratings").upsert({ user_id: authData.user.id, conversation_id: input.conversationId, task_id: input.taskId ?? null, stars: input.stars, note: input.note?.trim() || null, updated_at: new Date().toISOString() }, { onConflict: "user_id,conversation_id" });
  if (error) throw new Error("تعذر إرسال تقييم المهمة.");
}
