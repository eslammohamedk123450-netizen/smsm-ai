import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import type { AgentStep, ChatMessage, PendingConfirmation } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SulyIcon } from './SulyIcon';

interface ChatViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  liveSteps: AgentStep[];
  balance: number;
  onConnectGmail: () => void;
  isConnectingGmail?: boolean;
  onConfirmAction: (messageId: string, pending: PendingConfirmation, approved: boolean) => void;
}

const AgentStepsTrace: React.FC<{
  steps: AgentStep[];
  defaultOpen?: boolean;
  isLive?: boolean;
}> = ({ steps, defaultOpen = false, isLive = false }) => {
  const [open, setOpen] = useState(defaultOpen || isLive);

  useEffect(() => {
    if (isLive) setOpen(true);
  }, [isLive]);

  if (!steps.length) return null;

  const completedCount = steps.filter((s) => s.status === 'completed').length;

  return (
    <div className="mb-3 rounded-xl border border-[#262626] bg-[#0B0B0B] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-right hover:bg-[#141414] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isLive ? (
            <Loader2 className="w-3.5 h-3.5 text-[#0EA5E9] animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="text-[12px] font-bold text-[#E5E7EB] truncate">
            {isLive ? 'تفكير الوكيل وخطوات التنفيذ الحية' : 'خطوات تفكير الوكيل وتنفيذ المهمة'}
          </span>
          <span className="text-[11px] text-[#8B8B8B] font-mono tabular-nums shrink-0">
            {completedCount}/{steps.length}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-[#8B8B8B] shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#8B8B8B] shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-[#1F1F1F] px-3 py-2.5 space-y-2">
          {steps.map((step) => (
            <div key={step.id} className="flex items-start justify-between gap-3 text-[12px]">
              <div className="flex items-start gap-2 min-w-0">
                {step.status === 'running' ? (
                  <Loader2 className="w-3.5 h-3.5 text-[#0EA5E9] animate-spin shrink-0 mt-0.5" />
                ) : step.status === 'completed' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : step.status === 'requires_confirmation' ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="text-[#E5E7EB] leading-snug">{step.title}</div>
                  {(step.detail || step.modelName) && (
                    <div className="text-[11px] text-[#8B8B8B] mt-0.5 flex flex-wrap items-center gap-1.5">
                      {step.modelName && <span className="font-mono">{step.modelName}</span>}
                      {step.modelName && step.detail && <span aria-hidden="true">·</span>}
                      {step.detail && <span>{step.detail}</span>}
                    </div>
                  )}
                </div>
              </div>
              {typeof step.durationMs === 'number' && (
                <span className="text-[11px] text-[#71717A] font-mono tabular-nums shrink-0">
                  {step.durationMs}ms
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const GoogleSignInButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}> = ({ onClick, disabled = false, label = 'ربط حساب Gmail (Sign in with Google)' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="mt-3 inline-flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-[#1F1F1F] hover:bg-zinc-100 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
  >
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
    <span>{label}</span>
  </button>
);

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  isLoading,
  liveSteps,
  balance,
  onConnectGmail,
  isConnectingGmail = false,
  onConfirmAction,
}) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, liveSteps]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="flex-1 w-full overflow-y-auto custom-scrollbar px-4 py-6 max-w-3xl mx-auto space-y-6">
      {messages.map((message) => {
        const isUser = message.sender === 'user';
        if (isUser) {
          return (
            <div key={message.id} className="flex justify-start">
              <div className="max-w-[85%] sm:max-w-[75%] bg-[#FFFFFF] text-[#000000] p-4 rounded-2xl shadow-sm text-[16px] font-normal leading-[26px]">
                {message.text}
              </div>
            </div>
          );
        }

        return (
          <div key={message.id} className="flex flex-col items-end">
            <div className="w-full max-w-[95%] sm:max-w-[90%] bg-[#111111] text-[#F5F5F5] p-4 rounded-2xl border border-[#262626] shadow-sm relative group">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#262626]">
                <div className="flex items-center gap-2 min-w-0">
                  <SulyIcon size={18} />
                  <span className="text-[13px] font-bold text-[#F5F5F5]">Suly</span>
                  {message.mode && (
                    <span className="text-[11px] text-[#8B8B8B]">
                      · {message.mode === 'agent' ? 'وضع الوكيل' : 'محادثة'}
                    </span>
                  )}
                  {message.modelUsed && (
                    <span className="text-[11px] text-[#71717A] font-mono truncate hidden sm:inline">
                      · {message.modelUsed}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(message.id, message.text)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-[#1F1F1F] transition-colors cursor-pointer"
                  title="نسخ الرد"
                >
                  {copiedId === message.id ? (
                    <Check className="w-3.5 h-3.5 text-[#0EA5E9]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {message.agentSteps && message.agentSteps.length > 0 && (
                <AgentStepsTrace steps={message.agentSteps} />
              )}

              {message.text && <MarkdownRenderer content={message.text} />}

              {message.needsGmailConnect && (
                <div className="mt-3 pt-3 border-t border-[#262626]">
                  <GoogleSignInButton
                    onClick={onConnectGmail}
                    disabled={isConnectingGmail}
                    label={isConnectingGmail ? 'جاري فتح نافذة ربط Gmail...' : 'ربط حساب Gmail الآن'}
                  />
                </div>
              )}

              {message.pendingConfirmation && !message.confirmationResolved && (
                <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/20 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-300 text-[13px] font-bold">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>تأكيد مطلوب قبل التنفيذ: {message.pendingConfirmation.actionLabel}</span>
                  </div>
                  <p className="text-[13px] text-[#E5E7EB]">
                    {message.pendingConfirmation.summary}
                  </p>
                  {message.pendingConfirmation.preview.to && (
                    <div className="text-[12px] text-[#A1A1AA] space-y-1 bg-[#0B0B0B] rounded-lg p-2.5 border border-[#262626]">
                      <div>
                        <span className="text-[#71717A]">إلى: </span>
                        <span dir="ltr" className="font-mono text-[#F5F5F5]">
                          {message.pendingConfirmation.preview.to}
                        </span>
                      </div>
                      {message.pendingConfirmation.preview.subject && (
                        <div>
                          <span className="text-[#71717A]">الموضوع: </span>
                          <span className="text-[#F5F5F5]">
                            {message.pendingConfirmation.preview.subject}
                          </span>
                        </div>
                      )}
                      {message.pendingConfirmation.preview.body && (
                        <div className="pt-1 border-t border-[#1F1F1F] text-[#D4D4D8] whitespace-pre-wrap">
                          {message.pendingConfirmation.preview.body}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        onConfirmAction(message.id, message.pendingConfirmation!, true)
                      }
                      className="px-4 py-2 rounded-lg bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-[12px] font-bold transition-colors cursor-pointer"
                    >
                      تأكيد التنفيذ
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onConfirmAction(message.id, message.pendingConfirmation!, false)
                      }
                      className="px-4 py-2 rounded-lg bg-[#262626] hover:bg-[#333333] text-[#E5E7EB] text-[12px] font-bold transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {message.confirmationResolved && (
                <div className="mt-2 text-[12px] text-[#A1A1AA]">
                  {message.confirmationResolved === 'confirmed'
                    ? 'تم تأكيد الإجراء وتنفيذه.'
                    : 'تم إلغاء الإجراء بناءً على اختيارك.'}
                </div>
              )}
            </div>

            <div className="text-[11px] font-normal text-[#A1A1AA] mt-2 px-2 select-none self-start tabular-nums">
              التكلفة: {message.cost ?? 12} نقطة • المتبقي:{' '}
              {(message.remaining ?? balance).toLocaleString('en-US')}
            </div>
          </div>
        );
      })}

      {/* Live Thinking & Spinning Suly Indicator */}
      {isLoading && (
        <div className="flex flex-col items-end">
          <div className="w-full max-w-[95%] sm:max-w-[90%] bg-[#111111] text-[#F5F5F5] p-4 rounded-2xl border border-[#262626] space-y-3">
            <div className="flex items-center gap-3">
              <SulyIcon size={22} spinning />
              <div className="flex items-center gap-1.5 text-[13px] text-[#E5E7EB] font-medium">
                <span>Suly يحلل الطلب وينفذ الخطوات</span>
              </div>
            </div>
            {liveSteps.length > 0 && <AgentStepsTrace steps={liveSteps} isLive defaultOpen />}
          </div>
        </div>
      )}

      <div ref={scrollEndRef} />
    </div>
  );
};
