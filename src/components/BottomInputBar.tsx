import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  AudioWaveform,
  Bot,
  Mail,
  MessageSquare,
  Mic,
  Plus,
} from 'lucide-react';
import type { ExecutionMode, GmailConnectionState } from '../types';

interface BottomInputBarProps {
  onSendMessage: (text: string) => void;
  onOpenTaskSheet: () => void;
  onOpenRecharge: () => void;
  balance: number;
  isLoading?: boolean;
  executionMode: ExecutionMode;
  onChangeMode: (mode: ExecutionMode) => void;
  gmailConnection: GmailConnectionState;
  onConnectGmail: () => void;
  isConnectingGmail?: boolean;
  gmailNotice?: string | null;
  onDismissGmailNotice?: () => void;
}

export const BottomInputBar: React.FC<BottomInputBarProps> = ({
  onSendMessage,
  onOpenTaskSheet,
  onOpenRecharge,
  balance,
  isLoading = false,
  executionMode,
  onChangeMode,
  gmailConnection,
  onConnectGmail,
  isConnectingGmail = false,
  gmailNotice = null,
  onDismissGmailNotice,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleMicToggle = () => {
    setVoiceError(null);
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('التعرّف الصوتي غير مدعوم في هذا المتصفح.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-EG';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i += 1) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript.trim());
      };
      recognition.onerror = () => {
        setIsRecording(false);
        setVoiceError('تعذر التقاط الصوت. تأكد من صلاحية الميكروفون.');
      };
      recognition.onend = () => {
        setIsRecording(false);
      };
      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
    } catch {
      setIsRecording(false);
      setVoiceError('تعذر بدء التسجيل الصوتي.');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 pt-1">
      {balance < 500 && (
        <div className="mb-2.5 bg-[#1F1F1F] border border-[#262626] rounded-xl px-4 py-2.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#F87171] shrink-0" />
            <span className="text-[13px] text-[#F5F5F5] font-normal">
              رصيدك أوشك على النفاد (المتبقي: {balance.toLocaleString('en-US')} نقطة)
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenRecharge}
            className="bg-white text-black hover:bg-zinc-200 active:scale-95 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            اشحن الآن
          </button>
        </div>
      )}

      {voiceError && (
        <div className="mb-2 text-[12px] text-[#F87171] px-2">{voiceError}</div>
      )}

      {gmailNotice && (
        <div className="mb-2.5 bg-[#161616] border border-amber-500/35 rounded-xl px-3.5 py-2 flex items-center justify-between gap-2 text-[12px] text-amber-200">
          <span>{gmailNotice}</span>
          {onDismissGmailNotice && (
            <button
              type="button"
              onClick={onDismissGmailNotice}
              className="text-amber-300 hover:text-white text-[11px] font-bold shrink-0 cursor-pointer"
            >
              إغلاق
            </button>
          )}
        </div>
      )}

      {/* Main Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="h-[56px] bg-[#1F1F1F] border border-[#262626] rounded-full px-2 flex items-center gap-2 shadow-xl focus-within:border-[#333333] transition-colors"
      >
        <button
          type="button"
          onClick={onOpenTaskSheet}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-[#262626] active:scale-95 transition-all shrink-0 cursor-pointer"
          title="إضافة مهمة أو ملف"
          aria-label="إضافة مهمة"
        >
          <Plus className="w-5 h-5" />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            executionMode === 'agent'
              ? 'اسأل الوكيل الذكي (أو اطلب فحص Gmail وتنفيذ المهام)...'
              : 'اسأل Suly في المحادثة السريعة...'
          }
          disabled={isLoading}
          className="flex-1 bg-transparent text-[#F5F5F5] text-[15px] font-normal placeholder-[#A1A1AA] outline-hidden px-2 h-full text-right"
        />

        <div className="flex items-center gap-1.5 shrink-0 pl-1">
          <button
            type="button"
            onClick={handleMicToggle}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isRecording
                ? 'text-[#F87171] bg-white/10 animate-pulse'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#262626]'
            }`}
            title="التسجيل الصوتي"
            aria-label="تسجيل صوتي"
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            type="submit"
            disabled={isLoading || (!inputText.trim() && !isRecording)}
            className={`w-10 h-10 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 flex items-center justify-center text-white transition-all shadow-md cursor-pointer ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={inputText.trim() ? 'إرسال الرسالة' : 'موجات صوتية'}
            aria-label="إرسال"
          >
            {inputText.trim() ? (
              <ArrowUp className="w-5 h-5 stroke-[2.5]" />
            ) : (
              <AudioWaveform className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>

      {/* Mode Switcher & Live Gmail Connection Control underneath the input */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-1">
        <div
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#111111] border border-[#262626]"
          role="tablist"
          aria-label="وضع التشغيل"
        >
          <button
            type="button"
            role="tab"
            aria-selected={executionMode === 'chat'}
            onClick={() => onChangeMode('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              executionMode === 'chat'
                ? 'bg-[#262626] text-white'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>محادثة عادية</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={executionMode === 'agent'}
            onClick={() => onChangeMode('agent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              executionMode === 'agent'
                ? 'bg-[#0EA5E9]/20 text-[#38BDF8] border border-[#0EA5E9]/40'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>وضع الوكيل (Agent)</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onConnectGmail}
          disabled={isConnectingGmail}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            gmailConnection.connected
              ? 'bg-[#111111] border-emerald-800/60 text-emerald-400 hover:border-emerald-700'
              : 'bg-[#111111] border-[#262626] text-[#A1A1AA] hover:text-white hover:border-[#3A3A3A]'
          }`}
          title={
            gmailConnection.connected
              ? `متصل بـ ${gmailConnection.email || 'Gmail'}`
              : 'اضغط لربط حساب Gmail'
          }
        >
          <Mail className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate max-w-[180px]">
            {isConnectingGmail
              ? 'جاري ربط Gmail...'
              : gmailConnection.connected
                ? `Gmail متصل${gmailConnection.email ? ` · ${gmailConnection.email}` : ''}`
                : 'ربط Gmail'}
          </span>
        </button>
      </div>
    </div>
  );
};
