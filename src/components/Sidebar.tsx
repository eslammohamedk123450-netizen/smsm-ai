import React from 'react';
import { X, Plus, MessageSquare, CreditCard, Layers, Settings, ShieldCheck } from 'lucide-react';
import { SulyIcon } from './SulyIcon';
import { ScreenType } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: ScreenType) => void;
  onNewChat: () => void;
  balance: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onNewChat,
  balance,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container (Right side for RTL) */}
      <aside className="relative z-50 w-72 max-w-[85vw] h-full bg-[#111111] border-l border-[#262626] flex flex-col justify-between p-4 shadow-2xl">
        {/* Top Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
            <div className="flex items-center gap-2.5">
              <SulyIcon size={24} />
              <div className="flex flex-col">
                <span className="text-[17px] font-bold text-[#F5F5F5]">Suly</span>
                <span className="text-[11px] text-[#A1A1AA]">منظومة الأعمال الذكية</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-[#1F1F1F] transition-colors"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Chat Action */}
          <div className="mt-4">
            <button
              onClick={() => {
                onNewChat();
                onClose();
              }}
              className="w-full h-11 bg-white text-black hover:bg-zinc-200 active:scale-[0.98] rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>محادثة جديدة</span>
            </button>
          </div>

          {/* Menu Sections */}
          <div className="mt-6 space-y-1">
            <div className="text-[11px] font-normal text-[#A1A1AA] px-3 pb-2 uppercase tracking-wider">
              التنقل السريع
            </div>

            <button
              onClick={() => {
                onNavigate('home');
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-normal text-[#F5F5F5] hover:bg-[#1F1F1F] active:bg-[#262626] transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-[#0EA5E9]" />
              <span>المحادثة والمهام</span>
            </button>

            <button
              onClick={() => {
                onNavigate('balance');
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-normal text-[#F5F5F5] hover:bg-[#1F1F1F] active:bg-[#262626] transition-colors"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-[#0EA5E9]" />
                <span>الرصيد والاستهلاك</span>
              </div>
              <span className="text-[11px] bg-[#1F1F1F] border border-[#262626] px-2 py-0.5 rounded-full text-white font-bold">
                {balance.toLocaleString('en-US')}
              </span>
            </button>
          </div>

          {/* Recent Corporate Tasks */}
          <div className="mt-6 space-y-1">
            <div className="text-[11px] font-normal text-[#A1A1AA] px-3 pb-2 uppercase tracking-wider">
              سجل المهام الأخيرة
            </div>

            {[
              { id: '1', title: 'تحليل الموازنة التقديرية' },
              { id: '2', title: 'مراجعة بنود العقد الرسمي' },
              { id: '3', title: 'جدول الفعاليات والمعارض' },
              { id: '4', title: 'صياغة خطاب الشراكة' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate('chat');
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-normal text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#1F1F1F] transition-colors text-right truncate"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#262626] shrink-0" />
                <span className="truncate">{item.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Profile / Plan Info */}
        <div className="pt-4 border-t border-[#262626]">
          <div className="bg-[#1F1F1F] border border-[#262626] rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#111111] border border-[#262626] flex items-center justify-center text-[#0EA5E9]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">حساب الشركات</span>
                <span className="text-[11px] text-[#A1A1AA]">الخطة الحالية: Free</span>
              </div>
            </div>
            <button
              onClick={() => {
                onNavigate('balance');
                onClose();
              }}
              className="text-[11px] font-bold text-[#0EA5E9] hover:underline"
            >
              ترقية
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
