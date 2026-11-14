import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AgentStep,
  ExecutionMode,
  ModelConfig,
  PendingConfirmation,
  PlanTier,
} from '../src/types.ts';
import {
  getAdminCatalogState,
  selectEligibleModels,
} from './modelStore.ts';
import {
  checkLiveConnections,
  getGmailMessageDetail,
  listGmailMessages,
  modifyGmailLabels,
  sendGmailMessage,
  trashGmailMessage,
  type LiveConnectionReport,
} from './gmailBridge.ts';

export type StreamEmitter = (
  event:
    | { type: 'step'; step: AgentStep }
    | { type: 'chunk'; chunk: string }
    | { type: 'confirmation'; pendingConfirmation: PendingConfirmation }
    | { type: 'needs_gmail'; reason: string }
    | { type: 'done'; modelUsed: string; cost: number; totalMs: number }
    | { type: 'error'; error: string }
) => void;

export interface AgentRunInput {
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
  executionMode: ExecutionMode;
  planTier: PlanTier;
  gmailToken: string | null;
  composioApiKey?: string;
  confirmAction?: {
    requestId: string;
    approved: boolean;
    pendingConfirmation?: PendingConfirmation;
  };
}

function createAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function checkStrictIdentity(query: string): string | null {
  const q = query.replace(/[؟?.,!]/g, '').trim().toLowerCase();
  if (/^(انت مين|من انت|من أنت|عرف بنفسك|عرف عن نفسك|عرفنا بنفسك|ما هو سولي|ما هو suly|مين سولي|مين suly|انت ايه)$/i.test(q)) {
    return 'أنا Suly، مساعد ذكي تم تطويري بواسطة شركة Suly-Technologies.';
  }
  if (/^(مين اللي عملك|مين عملك|مين طورك|مين اللي طورك|من طورك|من صنعك|مين صنعك|مين برمجك|من برمجك|من انشاك|مين انشاك)$/i.test(q)) {
    return 'تم تطويري بواسطة شركة Suly-Technologies.';
  }
  if (/(suly-technologies|suly technologies|سولي تكنولوجي|كلمني عن الشرك[ةه]|ايه هي الشرك[ةه]|ما هي الشرك[ةه]|عن الشرك[ةه]|مين الشرك[ةه]|ما هي suly|معلومات عن الشرك[ةه])/i.test(q)) {
    return 'شركة Suly-Technologies هي شركة مصرية تدعم الابتكار والخدمات الإلكترونية والبرمجة، تم تأسيسها على يد المهندس: إسلام محمد البدوي.';
  }
  return null;
}

const IDENTITY_SYSTEM_INSTRUCTION = `أنت Suly، مساعد ذكي للشركات والمستخدمين، تتحدث بالعربية الفصحى الواضحة والاحترافية.
- ادخل في الإجابة مباشرة دون مقدمات مكررة أو ترحيب طويل.
- عند عرض قوائم أو إيميلات، استخدم جداول Markdown مرتبة أو نقاط واضحة.
- التزم بالصدق التام: لا تخترع أي بريد إلكتروني أو بيانات لم ترد من الأدوات.`;

export async function runRouterStream(
  input: AgentRunInput,
  emit: StreamEmitter
): Promise<void> {
  const startedAt = Date.now();
  const lastUserMessage = [...input.messages].reverse().find((m) => m.role === 'user')?.text?.trim() ?? '';

  if (!lastUserMessage) {
    emit({ type: 'error', error: 'الرسالة فارغة.' });
    return;
  }

  // Strict identity responses work instantaneously in both modes
  const strictIdentity = checkStrictIdentity(lastUserMessage);
  if (strictIdentity) {
    emit({ type: 'chunk', chunk: strictIdentity });
    emit({ type: 'done', modelUsed: 'Suly Identity Guard', cost: 4, totalMs: Date.now() - startedAt });
    return;
  }

  const ai = createAiClient();
  if (!ai) {
    emit({
      type: 'error',
      error: 'مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير متاح في إعدادات الخادم.',
    });
    return;
  }

  // -------------------------------------------------------------------------
  // MODE 1: CHAT MODE (Fast conversational routing using Admin-approved models)
  // -------------------------------------------------------------------------
  if (input.executionMode === 'chat') {
    const chatModels = selectEligibleModels({
      mode: 'chat',
      tier: input.planTier,
      requiredCapabilities: ['chat'],
      preferredRole: 'general',
    });

    if (chatModels.length === 0) {
      emit({
        type: 'error',
        error: `لا يوجد نموذج مفعّل لوضع المحادثة العادية في باقة ${input.planTier}. فعّل نموذجاً من لوحة تحكم الأدمن.`,
      });
      return;
    }

    const chosen = chatModels[0];
    emit({
      type: 'step',
      step: {
        id: 'chat-route',
        index: 0,
        kind: 'model_route',
        title: `توجيه المحادثة إلى ${chosen.name}`,
        modelName: chosen.modelIdentifier,
        status: 'completed',
        durationMs: Date.now() - startedAt,
      },
    });

    const historyText = input.messages
      .slice(-8)
      .map((m) => `${m.role === 'user' ? 'المستخدم' : 'Suly'}: ${m.text}`)
      .join('\n\n');

    const stream = await ai.models.generateContentStream({
      model: chosen.modelIdentifier,
      contents: historyText,
      config: {
        systemInstruction: IDENTITY_SYSTEM_INSTRUCTION,
        ...(chosen.modelIdentifier === 'gemini-4-hydrogen'
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) emit({ type: 'chunk', chunk: chunk.text });
    }

    emit({
      type: 'done',
      modelUsed: chosen.name,
      cost: 10,
      totalMs: Date.now() - startedAt,
    });
    return;
  }

  // -------------------------------------------------------------------------
  // MODE 2: AGENT MODE (Connection-aware, Multi-Model Orchestrator Loop)
  // -------------------------------------------------------------------------
  const { policy } = getAdminCatalogState();
  const plannerCandidates = selectEligibleModels({
    mode: 'agent',
    tier: input.planTier,
    requiredCapabilities: ['chat', 'tools'],
    preferredRole: 'planner',
    preferredModelId: policy.agentPlannerModelId,
  });

  if (plannerCandidates.length === 0) {
    emit({
      type: 'error',
      error: `لا يوجد نموذج وكيل (Agent + Tools) مفعّل لباقة ${input.planTier}. تحقق من صلاحيات النماذج في لوحة الأدمن.`,
    });
    return;
  }
  const plannerModel: ModelConfig = plannerCandidates[0];

  // Handle confirmed write continuation immediately
  if (input.confirmAction?.pendingConfirmation) {
    const pending = input.confirmAction.pendingConfirmation;
    if (!input.confirmAction.approved) {
      emit({
        type: 'chunk',
        chunk: 'تم إلغاء العملية بناءً على طلبك ولم يتم إجراء أي تعديل أو إرسال.',
      });
      emit({ type: 'done', modelUsed: plannerModel.name, cost: 2, totalMs: Date.now() - startedAt });
      return;
    }

    if (!input.gmailToken) {
      emit({
        type: 'needs_gmail',
        reason: 'انتهت جلسة ربط Gmail. أعد ربط حساب Gmail ثم أكد العملية.',
      });
      emit({ type: 'done', modelUsed: plannerModel.name, cost: 2, totalMs: Date.now() - startedAt });
      return;
    }

    const execStart = Date.now();
    emit({
      type: 'step',
      step: {
        id: 'confirmed-exec',
        index: 0,
        kind: 'tool_call',
        title: `تنفيذ العملية المؤكدة: ${pending.actionLabel}`,
        tool: pending.tool,
        status: 'running',
      },
    });

    try {
      let resultText = '';
      if (pending.tool === 'gmail_send_email' || pending.tool === 'gmail_reply_email') {
        const sent = await sendGmailMessage(input.gmailToken, {
          to: pending.preview.to ?? '',
          subject: pending.preview.subject ?? 'رسالة من Suly',
          body: pending.preview.body ?? '',
        });
        resultText = `تم إرسال البريد الإلكتروني بنجاح إلى **${pending.preview.to}** (معرف الرسالة: \`${sent.id}\`).`;
      } else if (pending.tool === 'gmail_trash_message' && pending.preview.messageId) {
        await trashGmailMessage(input.gmailToken, pending.preview.messageId);
        resultText = `تم نقل الرسالة (\`${pending.preview.messageId}\`) إلى المهملات بنجاح.`;
      } else if (pending.tool === 'gmail_modify_labels' && pending.preview.messageId) {
        await modifyGmailLabels(
          input.gmailToken,
          pending.preview.messageId,
          pending.preview.labelsToAdd ?? [],
          pending.preview.labelsToRemove ?? []
        );
        resultText = `تم تحديث حالة/تصنيفات الرسالة (\`${pending.preview.messageId}\`) بنجاح.`;
      }

      emit({
        type: 'step',
        step: {
          id: 'confirmed-exec',
          index: 0,
          kind: 'tool_call',
          title: `تم تنفيذ ${pending.actionLabel}`,
          tool: pending.tool,
          status: 'completed',
          durationMs: Date.now() - execStart,
        },
      });
      emit({ type: 'chunk', chunk: resultText });
      emit({ type: 'done', modelUsed: plannerModel.name, cost: 14, totalMs: Date.now() - startedAt });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تنفيذ العملية.';
      emit({
        type: 'step',
        step: {
          id: 'confirmed-exec',
          index: 0,
          kind: 'error',
          title: 'تعذر إكمال العملية المؤكدة',
          detail: msg,
          status: 'failed',
          durationMs: Date.now() - execStart,
        },
      });
      emit({ type: 'error', error: msg });
    }
    return;
  }

  // Step 1: Real Connection Verification
  const connStepStart = Date.now();
  emit({
    type: 'step',
    step: {
      id: 'step-conn',
      index: 0,
      kind: 'connection_check',
      title: 'التحقق من حالة الاتصال بـ Gmail والتطبيقات المرتبطة...',
      status: 'running',
    },
  });

  const connReport: LiveConnectionReport = await checkLiveConnections(
    input.gmailToken,
    input.composioApiKey
  );

  emit({
    type: 'step',
    step: {
      id: 'step-conn',
      index: 0,
      kind: 'connection_check',
      title: connReport.gmail.connected
        ? `تم تأكيد الاتصال بـ Gmail (${connReport.gmail.email ?? connReport.gmail.source})`
        : 'Gmail غير متصل حالياً',
      detail: connReport.gmail.connected
        ? `المصدر: ${connReport.gmail.source === 'gmail_oauth' ? 'ربط Gmail المباشر' : 'Composio'}`
        : 'يمكن ربط الحساب مباشرة بضغطة زر',
      status: 'completed',
      durationMs: Date.now() - connStepStart,
    },
  });

  // Step 2: Planner Model Routing & Intent Analysis
  const planStepStart = Date.now();
  emit({
    type: 'step',
    step: {
      id: 'step-plan',
      index: 1,
      kind: 'planning',
      title: `تحليل المهمة عبر ${plannerModel.name}`,
      modelName: plannerModel.modelIdentifier,
      status: 'running',
    },
  });

  const recentContext = input.messages
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.slice(0, 1200)}`)
    .join('\n');

  const plannerPrompt = `You are the fast routing & planning brain of Suly Agent.
Current live connection status:
- Gmail connected: ${connReport.gmail.connected} (source: ${connReport.gmail.source}, account: ${connReport.gmail.email ?? 'none'})
- Composio configured: ${connReport.composio.configured}

Recent conversation:
${recentContext}

Available tools:
1. "gmail_list_messages": Read/list recent emails from Gmail. Args: { maxResults: number (1..20), mailbox: "inbox" | "sent" | "all", query?: string }.
   - Note on Arabic phrasing: "مبعوتة من مين" / "وصلتني" / "آخر 10 إيميلات" means received emails ("inbox" or "all"). Only use "sent" if the user explicitly says emails they sent ("اللي انا بعتها" / "المرسلة مني").
2. "gmail_get_message": Read the full body content of a specific email. Args: { messageId: string }.
3. "gmail_send_email": Send a new email or reply (WRITE action - will ask user confirmation). Args: { to: string, subject: string, body: string }.
4. "gmail_trash_message": Move an email to trash (WRITE action - will ask user confirmation). Args: { messageId: string }.
5. "gmail_modify_labels": Mark email read/unread or archive (WRITE action - will ask user confirmation). Args: { messageId: string, addLabelIds?: string[], removeLabelIds?: string[] }.
6. "check_connections": Report connection status clearly if user only asked whether Gmail/apps are connected.

Rules:
- If the user asks about emails or Gmail tasks AND Gmail is NOT connected, choose action="needs_gmail" with a short Arabic explanation.
- If the user simply asks "هل أنا متصل بجميل؟" / "تأكد من الاتصال", choose action="respond" and state the EXACT live status above!
- If the user wants to read/search/summarize emails and Gmail IS connected, choose action="tool" with "gmail_list_messages" or "gmail_get_message".
- If the user asks a general non-Gmail task in Agent mode, choose action="respond_direct" so the summarizer/general model answers directly.

Return strict JSON matching the schema.`;

  let planDecision: {
    action: 'tool' | 'respond' | 'respond_direct' | 'needs_gmail';
    toolName?: string;
    maxResults?: number;
    mailbox?: string;
    query?: string;
    messageId?: string;
    to?: string;
    subject?: string;
    body?: string;
    answer?: string;
    reasoningSummary?: string;
  };

  try {
    const planRes = await ai.models.generateContent({
      model: plannerModel.modelIdentifier,
      contents: plannerPrompt,
      config: {
        responseMimeType: 'application/json',
        ...(plannerModel.modelIdentifier === 'gemini-4-hydrogen'
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
              description: 'One of: tool, respond, respond_direct, needs_gmail',
            },
            toolName: { type: Type.STRING },
            maxResults: { type: Type.INTEGER },
            mailbox: { type: Type.STRING },
            query: { type: Type.STRING },
            messageId: { type: Type.STRING },
            to: { type: Type.STRING },
            subject: { type: Type.STRING },
            body: { type: Type.STRING },
            answer: { type: Type.STRING },
            reasoningSummary: {
              type: Type.STRING,
              description: 'Short Arabic 1-line summary of the planned step',
            },
          },
          required: ['action', 'reasoningSummary'],
        },
      },
    });
    planDecision = JSON.parse((planRes.text ?? '{}').trim());
  } catch {
    planDecision = {
      action: 'respond_direct',
      reasoningSummary: 'التحول مباشرة لصياغة الرد عبر النموذج المتخصص',
    };
  }

  emit({
    type: 'step',
    step: {
      id: 'step-plan',
      index: 1,
      kind: 'planning',
      title: planDecision.reasoningSummary || 'تم تحديد مسار التنفيذ',
      modelName: plannerModel.name,
      status: 'completed',
      durationMs: Date.now() - planStepStart,
    },
  });

  if (planDecision.action === 'needs_gmail' || (!connReport.gmail.connected && planDecision.toolName?.startsWith('gmail_'))) {
    const msg =
      planDecision.answer ||
      'حساب Gmail غير متصل حالياً بالتطبيق. اضغط على زر **ربط Gmail** أدناه لمنح الصلاحية وسأقوم بتنفيذ طلبك فوراً.';
    emit({ type: 'needs_gmail', reason: msg });
    emit({ type: 'chunk', chunk: msg });
    emit({ type: 'done', modelUsed: plannerModel.name, cost: 6, totalMs: Date.now() - startedAt });
    return;
  }

  if (planDecision.action === 'respond' && planDecision.answer) {
    emit({ type: 'chunk', chunk: planDecision.answer });
    emit({ type: 'done', modelUsed: plannerModel.name, cost: 8, totalMs: Date.now() - startedAt });
    return;
  }

  // Step 3: Tool Execution OR Direct Agent Synthesis
  let toolEvidence: unknown = null;
  let usedToolLabel = '';

  if (planDecision.action === 'tool' && planDecision.toolName) {
    const toolName = planDecision.toolName;

    // Enforce confirmation on ALL write/modify/delete tools
    if (
      toolName === 'gmail_send_email' ||
      toolName === 'gmail_trash_message' ||
      toolName === 'gmail_modify_labels'
    ) {
      const actionLabels: Record<string, string> = {
        gmail_send_email: 'إرسال بريد إلكتروني عبر Gmail',
        gmail_trash_message: 'نقل رسالة بريد إلى المهملات',
        gmail_modify_labels: 'تعديل حالة/تصنيفات رسالة Gmail',
      };
      const pendingConfirmation: PendingConfirmation = {
        requestId: `confirm-${Date.now()}`,
        tool: toolName,
        actionLabel: actionLabels[toolName] ?? toolName,
        summary:
          toolName === 'gmail_send_email'
            ? `إرسال رسالة إلى ${planDecision.to || '(غير محدد)'} بعنوان "${planDecision.subject || 'بدون عنوان'}"`
            : `تنفيذ ${actionLabels[toolName]} على الرسالة ${planDecision.messageId || ''}`,
        originalPrompt: lastUserMessage,
        preview: {
          to: planDecision.to,
          subject: planDecision.subject,
          body: planDecision.body,
          messageId: planDecision.messageId,
        },
      };

      emit({
        type: 'step',
        step: {
          id: 'step-confirm',
          index: 2,
          kind: 'confirmation',
          title: 'بانتظار موافقة المستخدم قبل التنفيذ',
          detail: pendingConfirmation.summary,
          tool: toolName,
          status: 'requires_confirmation',
        },
      });
      emit({ type: 'confirmation', pendingConfirmation });
      emit({ type: 'done', modelUsed: plannerModel.name, cost: 6, totalMs: Date.now() - startedAt });
      return;
    }

    // Read-only tool execution
    if (!input.gmailToken) {
      const msg = 'يرجى ربط حساب Gmail أولاً ليتمكن الوكيل من قراءة رسائلك بأمان.';
      emit({ type: 'needs_gmail', reason: msg });
      emit({ type: 'chunk', chunk: msg });
      emit({ type: 'done', modelUsed: plannerModel.name, cost: 5, totalMs: Date.now() - startedAt });
      return;
    }

    const toolStart = Date.now();
    usedToolLabel = toolName;
    emit({
      type: 'step',
      step: {
        id: 'step-tool',
        index: 2,
        kind: 'tool_call',
        title:
          toolName === 'gmail_get_message'
            ? 'قراءة المحتوى الكامل للرسالة من Gmail...'
            : `جلب آخر ${planDecision.maxResults ?? 10} رسائل من Gmail...`,
        tool: toolName,
        status: 'running',
      },
    });

    try {
      if (toolName === 'gmail_get_message' && planDecision.messageId) {
        toolEvidence = await getGmailMessageDetail(input.gmailToken, planDecision.messageId);
      } else {
        const labelIds =
          planDecision.mailbox === 'sent'
            ? ['SENT']
            : planDecision.mailbox === 'inbox'
              ? ['INBOX']
              : undefined;
        toolEvidence = await listGmailMessages(input.gmailToken, {
          maxResults: planDecision.maxResults ?? 10,
          query: planDecision.query,
          labelIds,
        });
      }

      const count = Array.isArray(toolEvidence) ? toolEvidence.length : 1;
      emit({
        type: 'step',
        step: {
          id: 'step-tool',
          index: 2,
          kind: 'tool_call',
          title: Array.isArray(toolEvidence)
            ? `تم استلام ${count} رسالة من Gmail بنجاح`
            : 'تم جلب تفاصيل الرسالة بنجاح',
          tool: toolName,
          status: 'completed',
          durationMs: Date.now() - toolStart,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطأ أثناء الاتصال بـ Gmail.';
      emit({
        type: 'step',
        step: {
          id: 'step-tool',
          index: 2,
          kind: 'error',
          title: 'تعذر جلب البيانات من مزود Gmail',
          detail: msg,
          status: 'failed',
          durationMs: Date.now() - toolStart,
        },
      });
      if (/401|403/.test(msg)) {
        emit({ type: 'needs_gmail', reason: 'انتهت صلاحية تصريح Gmail. أعد ربط الحساب.' });
      }
      emit({ type: 'error', error: msg });
      return;
    }
  }

  // Step 4: Select the NEXT specialized model configured in Admin for Synthesis / Summarization
  const handoffStart = Date.now();
  const requiredCaps = usedToolLabel ? (['read', 'gmail'] as const) : (['read'] as const);
  const summarizerCandidates = selectEligibleModels({
    mode: 'agent',
    tier: input.planTier,
    requiredCapabilities: [...requiredCaps],
    preferredRole: 'summarizer',
    preferredModelId: usedToolLabel ? policy.gmailTaskModelId : policy.agentSummarizerModelId,
  });

  const summarizerModel = summarizerCandidates[0] ?? plannerModel;

  emit({
    type: 'step',
    step: {
      id: 'step-handoff',
      index: usedToolLabel ? 3 : 2,
      kind: 'next_model_handoff',
      title: `تحويل البيانات إلى النموذج المهيأ للمرحلة التالية: ${summarizerModel.name}`,
      modelName: summarizerModel.modelIdentifier,
      status: 'running',
    },
  });

  const synthesisPrompt = toolEvidence
    ? `طلب المستخدم: "${lastUserMessage}"

البيانات الحقيقية الواردة من Gmail (${connReport.gmail.email ?? 'حساب متصل'}):
${JSON.stringify(toolEvidence, null, 2)}

المطلوب منك كنموذج التلخيص والتحليل المتخصص:
1. قدّم ملخصاً احترافياً سريع الفهم باللغة العربية:
   - اذكر أسماء الشركات والجهات المرسلة المستخلصة بوضوح.
   - اعرض جدول Markdown منسق يحتوي على: (الرقم | المرسل / الشركة | الموضوع | التاريخ | الخلاصة، ومعرّف الرسالة مختصراً إذا احتاج).
2. إذا كانت رسالة واحدة كاملة (gmail_get_message)، اعرض بياناتها ومحتواها بالكامل بشكل منظم مع أبرز النقاط المطلوبة.
3. في نهاية الرد، اسأل المستخدم بلطف إذا كان يريد عرض المحتوى الكامل لأي رسالة معينة (بذكر رقمها أو موضوعها) أو الرد على أي منها.
4. لا تذكر أي معلومات غير موجودة في البيانات أعلاه.`
    : `طلب المستخدم في وضع الوكيل: "${lastUserMessage}"
سياق المحادثة الأخير:
${recentContext}

قدّم إجابة تنفيذية دقيقة ومباشرة ومرتبة بجداول أو نقاط واضحة.`;

  const stream = await ai.models.generateContentStream({
    model: summarizerModel.modelIdentifier,
    contents: synthesisPrompt,
    config: {
      systemInstruction: IDENTITY_SYSTEM_INSTRUCTION,
      ...(summarizerModel.modelIdentifier === 'gemini-4-hydrogen'
        ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
        : {}),
    },
  });

  let firstChunkSeen = false;
  for await (const chunk of stream) {
    if (chunk.text) {
      if (!firstChunkSeen) {
        firstChunkSeen = true;
        emit({
          type: 'step',
          step: {
            id: 'step-handoff',
            index: usedToolLabel ? 3 : 2,
            kind: 'next_model_handoff',
            title: `اكتملت الصياغة عبر ${summarizerModel.name}`,
            modelName: summarizerModel.modelIdentifier,
            status: 'completed',
            durationMs: Date.now() - handoffStart,
          },
        });
      }
      emit({ type: 'chunk', chunk: chunk.text });
    }
  }

  emit({
    type: 'done',
    modelUsed: `${plannerModel.name} → ${summarizerModel.name}`,
    cost: usedToolLabel ? 18 : 12,
    totalMs: Date.now() - startedAt,
  });
}
