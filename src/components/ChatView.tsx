import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SulyIcon } from './SulyIcon';
import { Copy, Check } from 'lucide-react';

interface ChatViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  balance: number;
}

export const ChatView: React.FC<ChatViewProps> = ({ messages, isLoading, balance }) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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
              {/* User Bubble:
                  خلفية #FFFFFF ونصها #000000، حجم 16 Regular و lineHeight 26 */}
              <div className="max-w-[85%] sm:max-w-[75%] bg-[#FFFFFF] text-[#000000] p-4 rounded-2xl shadow-sm text-[16px] font-normal leading-[26px]">
                {message.text}
              </div>
            </div>
          );
        }

        // Assistant Bubble:
        // خلفية #111111 ونصها #F5F5F5 و padding 16 و borderRadius 16
        return (
          <div key={message.id} className="flex flex-col items-end">
            <div className="w-full max-w-[95%] sm:max-w-[90%] bg-[#111111] text-[#F5F5F5] p-4 rounded-2xl border border-[#262626] shadow-sm relative group">
              {/* Header with Suly branding & copy action */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#262626]">
                <div className="flex items-center gap-2">
                  <SulyIcon size={18} />
                  <span className="text-[13px] font-bold text-[#F5F5F5]">Suly</span>
                </div>
                <button
                  onClick={() => handleCopy(message.id, message.text)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-[#1F1F1F] transition-colors"
                  title="نسخ الرد"
                >
                  {copiedId === message.id ? (
                    <Check className="w-3.5 h-3.5 text-[#0EA5E9]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Render Assistant Markdown */}
              <MarkdownRenderer content={message.text} />
            </div>

            {/* Sub-line under every assistant response:
                سطر صغير بلون #A1A1AA وحجم 11: "التكلفة: 12 نقطة • المتبقي: 9,850" */}
            <div className="text-[11px] font-normal text-[#A1A1AA] mt-2 px-2 select-none self-start">
              التكلفة: {message.cost ?? 12} نقطة • المتبقي:{' '}
              {(message.remaining ?? balance).toLocaleString('en-US')}
            </div>
          </div>
        );
      })}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex flex-col items-end">
          <div className="w-full max-w-[95%] sm:max-w-[90%] bg-[#111111] text-[#F5F5F5] p-4 rounded-2xl border border-[#262626] flex items-center gap-3">
            <SulyIcon size={20} className="animate-spin" />
            <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA]">
              <span>Suly يحلل الطلب ويصيغ الرد التنفيذي</span>
              <span className="inline-flex gap-1 mr-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] animate-bounce [animation-delay:0.4s]" />
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={scrollEndRef} />
    </div>
  );
};
