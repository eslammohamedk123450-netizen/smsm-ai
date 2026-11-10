import React, { useMemo, useState } from 'react';
import {
  Archive,
  CreditCard,
  MoreHorizontal,
  PencilLine,
  Pin,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { ScreenType } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: ScreenType) => void;
  onNewChat: () => void;
  balance: number;
  currentScreen: ScreenType;
}

type ConversationGroup = 'today' | 'yesterday' | 'last7' | 'last30';

type SidebarConversation = {
  id: string;
  firstMessage: string;
  createdAt: string;
  group: ConversationGroup;
  pinned?: boolean;
};

const sidebarConversations: SidebarConversation[] = [
  { id: 'c-1', firstMessage: 'أريد خطة إطلاق متجر إلكتروني جديد في الرياض', createdAt: '2026-11-10T09:44:00', group: 'today' },
  { id: 'c-2', firstMessage: 'راجع هذا العقد وأخبرني نقاط الخطر القانونية', createdAt: '2026-11-10T08:08:00', group: 'today' },
  { id: 'c-3', firstMessage: 'اكتب لي اقتراح تسويقي لمنتج جديد خلال 3 أسطر', createdAt: '2026-11-09T17:35:00', group: 'yesterday' },
  { id: 'c-4', firstMessage: 'حلّل أداء المبيعات للربع الحالي وقدم توصيات', createdAt: '2026-11-08T13:20:00', group: 'last7' },
  { id: 'c-5', firstMessage: 'أعد صياغة خطاب شراكة مع مقدم خدمة لوجستية', createdAt: '2026-11-04T15:55:00', group: 'last7' },
  { id: 'c-6', firstMessage: 'خطة تنفيذ التحديثات التقنية للفريق خلال 30 يوم', createdAt: '2026-10-29T11:10:00', group: 'last30' },
  { id: 'c-7', firstMessage: '', createdAt: '2026-11-09T10:00:00', group: 'yesterday' },
];

const groupLabels: Record<ConversationGroup, string> = {
  today: 'اليوم',
  yesterday: 'أمس',
  last7: 'آخر 7 أيام',
  last30: 'آخر 30 يوم',
};

const truncateTitle = (text: string): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > 28 ? `${clean.slice(0, 28)}...` : clean;
};

const formatMenuItem = (label: string) => (
  <span className="text-[12px] text-[#E5E7EB]">{label}</span>
);

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onNewChat,
  balance,
  currentScreen,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const groupedConversations = useMemo(() => {
    const filtered = sidebarConversations
      .map((conversation) => ({
        ...conversation,
        title: truncateTitle(conversation.firstMessage),
      }))
      .filter((conversation) => {
        if (!conversation.title) return false;
        return conversation.title.toLowerCase().includes(searchQuery.toLowerCase());
      });

    return {
      today: filtered.filter((item) => item.group === 'today'),
      yesterday: filtered.filter((item) => item.group === 'yesterday'),
      last7: filtered.filter((item) => item.group === 'last7'),
      last30: filtered.filter((item) => item.group === 'last30'),
    } as Record<ConversationGroup, typeof filtered>;
  }, [searchQuery]);

  const activeItemClass =
    'bg-[#2A2A2A] text-[#F5F5F5] border border-[#3A3A3A]';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="relative z-50 h-full w-[280px] max-w-[85vw] bg-[#111111] border-l border-[#262626] shadow-2xl flex flex-col">
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <section className="pb-3 border-b border-[#1F1F1F]">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onNewChat();
                  onClose();
                }}
                className="flex-1 h-11 rounded-full bg-white text-black text-[14px] font-bold flex items-center justify-center gap-2 transition-all hover:bg-[#E4E4E7] active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" />
                <span>محادثة جديدة</span>
              </button>
            </div>

            <label className="relative mt-3 block">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B8B8B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="بحث"
                aria-label="بحث في المحادثات"
                className="w-full h-10 rounded-xl border border-[#2A2A2A] bg-[#181818] pr-10 pl-3 text-[14px] text-[#F5F5F5] placeholder:text-[#8B8B8B] outline-none ring-0 focus:border-[#404040]"
              />
            </label>
          </section>

          <section className="pt-4">
            <div className="mb-2 px-2 text-[12px] font-medium text-[#8B8B8B]">المحادثات</div>

            {Object.entries(groupedConversations).map(([groupKey, items]) => {
              const group = groupKey as ConversationGroup;
              if (items.length === 0) return null;

              return (
                <div key={group} className="mb-3 space-y-1.5">
                  <div className="px-2 pb-1 text-[11px] font-medium text-[#6B7280]">
                    {groupLabels[group]}
                  </div>

                  {items.map((item) => (
                    <div key={item.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('chat');
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-right transition-colors ${
                          currentScreen === 'chat' ? activeItemClass : 'text-[#D4D4D8] hover:bg-[#1D1D1D]'
                        }`}
                      >
                        <span className="truncate text-[14px] font-normal">{item.title}</span>
                        {item.pinned && (
                          <Pin className="w-3.5 h-3.5 shrink-0 text-[#A1A1AA]" />
                        )}
                      </button>

                      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuOpenId((prev) => (prev === item.id ? null : item.id));
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#303030] bg-[#1C1C1C] text-[#A1A1AA] hover:bg-[#242424] hover:text-[#F5F5F5]"
                          aria-label="خيارات المحادثة"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {menuOpenId === item.id && (
                          <div className="absolute left-0 top-9 z-20 min-w-[160px] rounded-xl border border-[#2A2A2A] bg-[#181818] p-1 shadow-xl">
                            <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#222222]">
                              <PencilLine className="w-4 h-4 text-[#A1A1AA]" />
                              {formatMenuItem('إعادة تسمية')}
                            </button>
                            <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#222222]">
                              <Pin className="w-4 h-4 text-[#A1A1AA]" />
                              {formatMenuItem('تثبيت')}
                            </button>
                            <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#222222]">
                              <Archive className="w-4 h-4 text-[#A1A1AA]" />
                              {formatMenuItem('أرشفة')}
                            </button>
                            <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#222222]">
                              <Trash2 className="w-4 h-4 text-[#F87171]" />
                              <span className="text-[12px] text-[#F87171]">حذف</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        </div>

        <div className="border-t border-[#1F1F1F] px-3 py-3 space-y-3">
          <section className="rounded-2xl border border-[#2A2A2A] bg-[#171717] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] text-[#8B8B8B]">الرصيد</span>
              <span className="text-[14px] font-bold text-[#F5F5F5]">
                {balance.toLocaleString('en-US')}
              </span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2A2A2A]">
              <div className="h-full w-[72%] rounded-full bg-[#FACC15]" />
            </div>

            <button
              type="button"
              onClick={() => {
                onNavigate('balance');
                onClose();
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#FACC15]/50 bg-[#FACC15]/10 px-3 py-2 text-[13px] font-bold text-[#F5D76A] transition-colors hover:bg-[#FACC15]/15"
            >
              <Sparkles className="w-4 h-4" />
              ترقية
            </button>
          </section>

          <section className="space-y-2">
            <div className="px-2 text-[12px] font-medium text-[#8B8B8B]">الحساب والإعدادات</div>

            <button
              type="button"
              onClick={() => {
                onNavigate('balance');
                onClose();
              }}
              className={`w-full flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[14px] text-[#E5E7EB] transition-colors ${
                currentScreen === 'balance' ? activeItemClass : 'hover:bg-[#1D1D1D]'
              }`}
            >
              <UserRound className="w-5 h-5 text-[#A1A1AA]" />
              <span>الحساب</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onNavigate('home');
                onClose();
              }}
              className={`w-full flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[14px] text-[#E5E7EB] transition-colors ${
                currentScreen === 'home' ? activeItemClass : 'hover:bg-[#1D1D1D]'
              }`}
            >
              <Settings className="w-5 h-5 text-[#A1A1AA]" />
              <span>الإعدادات</span>
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
};

export default Sidebar;
