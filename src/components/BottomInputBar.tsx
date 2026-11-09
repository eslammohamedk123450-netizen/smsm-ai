import React, { useState, useRef } from 'react';
import { Plus, Mic, AudioWaveform, ArrowUp, AlertCircle } from 'lucide-react';

interface BottomInputBarProps {
  onSendMessage: (text: string) => void;
  onOpenTaskSheet: () => void;
  onOpenRecharge: () => void;
  balance: number;
  isLoading?: boolean;
}

export const BottomInputBar: React.FC<BottomInputBarProps> = ({
  onSendMessage,
  onOpenTaskSheet,
  onOpenRecharge,
  balance,
  isLoading = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleMicToggle = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // Gentle voice prompt simulation for corporate voice typing
      setTimeout(() => {
        setInputText('أريد ملخصاً تنفيذياً لتقييم أداء المشروع وتقديم التوصيات');
        setIsRecording(false);
      }, 2000);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 pt-1">
      {/* Low Balance Warning Banner (shown if balance < 500) */}
      {balance < 500 && (
        <div className="mb-2.5 bg-[#1F1F1F] border border-[#262626] rounded-xl px-4 py-2.5 flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#F87171] shrink-0" />
            <span className="text-[13px] text-[#F5F5F5] font-normal">
              رصيدك أوشك على النفاد (المتبقي: {balance.toLocaleString('en-US')} نقطة)
            </span>
          </div>
          <button
            onClick={onOpenRecharge}
            className="bg-white text-black hover:bg-zinc-200 active:scale-95 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            اشحن الآن
          </button>
        </div>
      )}

      {/* Main Input Bar:
          خلفية #1F1F1F و borderRadius 999 وارتفاع 56، على اليمين "+"، في المنتصف "اسأل Suly"،
          على اليسار أيقونة مايك، وزر دائري أزرق #2563EB بأيقونة موجات صوت */}
      <form
        onSubmit={handleSubmit}
        className="h-[56px] bg-[#1F1F1F] border border-[#262626] rounded-full px-2 flex items-center gap-2 shadow-xl focus-within:border-[#333333] transition-colors"
      >
        {/* Right side (RTL start): "+" button */}
        <button
          type="button"
          onClick={onOpenTaskSheet}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-[#262626] active:scale-95 transition-all shrink-0 cursor-pointer"
          title="إضافة مهمة أو ملف"
          aria-label="إضافة مهمة"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Center: Input field with placeholder "اسأل Suly" */}
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="اسأل Suly"
          disabled={isLoading}
          className="flex-1 bg-transparent text-[#F5F5F5] text-[15px] font-normal placeholder-[#A1A1AA] outline-hidden px-2 h-full text-right"
        />

        {/* Left side (RTL end): Mic icon + Blue circular button with sound waves */}
        <div className="flex items-center gap-1.5 shrink-0 pl-1">
          {/* Mic icon */}
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

          {/* Circular Blue Button #2563EB with Audio Waveform / Submit Icon */}
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
    </div>
  );
};
