import React, { useMemo, useState } from 'react';
import {
  Archive,
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
import { ConversationRecord, ScreenType } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: ScreenType) => void;
  onNewChat: () => void;
  onSelectConversation: (conversation: ConversationRecord) => void;
  onRenameConversation: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onArchiveConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onUpgrade: () => void;
  conversations: ConversationRecord[];
  currentConversationId: string | null;
  balance: number;
  currentScreen: ScreenType;
};

type ConversationGroup = 'today' | 'yesterday' | 'last7' | 'last30';
const GROUPS: ConversationGroup[] = ['today', 'yesterday', 'last7', 'last30'];
const groupLabels: Record<ConversationGroup, string> = {
  today: 'اليوم', yesterday: 'أمس', last7: 'آخر 7 أيام', last30: 'آخر 30 يوم',
};

function getConversationGroup(dateValue: string): ConversationGroup | null {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'last7';
  if (days < 30) return 'last30';
  return null;
}

function formatDate(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

function shortenTitle(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  return clean.length > 28 ? `${clean.slice(0, 28)}...` : clean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen, onClose, onNavigate, onNewChat, onSelectConversation,
  onRenameConversation, onTogglePin, onArchiveConversation, onDeleteConversation,
  onUpgrade, conversations, currentConversationId, balance, currentScreen,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const groupedConversations = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const visible = conversations
      .filter((conversation) => !conversation.archived && conversation.messages.some((message) => message.sender === 'user' && message.text.trim()))
      .map((conversation) => ({ ...conversation, group: getConversationGroup(conversation.createdAt) }))
      .filter((conversation) => conversation.group && conversation.title.trim())
      .filter((conversation) => !query || conversation.title.toLocaleLowerCase().includes(query))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return Object.fromEntries(GROUPS.map((group) => [group, visible.filter((conversation) => conversation.group === group)])) as unknown as Record<ConversationGroup, ConversationRecord[]>;
  }, [conversations, searchQuery]);

  const activeItemClass = 'bg-[#2A2A2A] text-[#F5F5F5] border border-[#3A3A3A]';
  const closeMenu = () => setMenuOpenId(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button className="fixed inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} aria-label="إغلاق القائمة" />
      <aside className="relative z-50 flex h-full w-[280px] max-w-[85vw] flex-col border-l border-[#262626] bg-[#111111] shadow-2xl">
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <section className="border-b border-[#1F1F1F] pb-3">
            <button type="button" onClick={() => { onNewChat(); onClose(); }} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-[14px] font-bold text-black transition-colors hover:bg-[#E4E4E7] active:scale-[0.98]">
              <Plus className="h-5 w-5" /><span>محادثة جديدة</span>
            </button>
            <label className="relative mt-3 block">
              <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8B8B8B]" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="بحث" aria-label="بحث في المحادثات" className="h-10 w-full rounded-xl border border-[#2A2A2A] bg-[#181818] pr-10 pl-3 text-[14px] text-[#F5F5F5] outline-none placeholder:text-[#8B8B8B] focus:border-[#404040]" />
            </label>
          </section>

          <section className="pt-4">
            <div className="mb-2 px-2 text-[14px] font-medium text-[#8B8B8B]">المحادثات</div>
            {GROUPS.map((group) => {
              const items = groupedConversations[group];
              if (!items.length) return null;
              return <div key={group} className="mb-3 space-y-1">
                <div className="px-2 pb-1 text-[12px] font-medium text-[#777777]">{groupLabels[group]}</div>
                {items.map((conversation) => <div key={conversation.id} className="group relative">
                  <button type="button" onClick={() => { onSelectConversation(conversation); onClose(); closeMenu(); }} className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-right transition-colors ${currentConversationId === conversation.id ? activeItemClass : 'text-[#D4D4D8] hover:bg-[#1D1D1D]'}`}>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-normal">{shortenTitle(conversation.title)}</span>
                    <span className="shrink-0 text-[12px] text-[#777777]">{formatDate(conversation.updatedAt)}</span>
                    {conversation.pinned && <Pin className="h-4 w-4 shrink-0 text-[#A1A1AA]" />}
                  </button>
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <button type="button" onClick={(event) => { event.stopPropagation(); setMenuOpenId((previous) => previous === conversation.id ? null : conversation.id); }} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#303030] bg-[#1C1C1C] text-[#A1A1AA] hover:bg-[#242424] hover:text-white" aria-label="خيارات المحادثة" aria-expanded={menuOpenId === conversation.id}>
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                    {menuOpenId === conversation.id && <div className="absolute left-0 top-9 z-20 min-w-[160px] rounded-xl border border-[#2A2A2A] bg-[#181818] p-1 shadow-xl" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={() => { const name = window.prompt('اكتب عنوان المحادثة', conversation.title); if (name?.trim()) onRenameConversation(conversation.id, name.trim()); closeMenu(); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#222222]"><PencilLine className="h-5 w-5 text-[#A1A1AA]" /><span className="text-[12px] text-[#E5E7EB]">إعادة تسمية</span></button>
                      <button type="button" onClick={() => { onTogglePin(conversation.id); closeMenu(); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#222222]"><Pin className="h-5 w-5 text-[#A1A1AA]" /><span className="text-[12px] text-[#E5E7EB]">{conversation.pinned ? 'إلغاء التثبيت' : 'تثبيت'}</span></button>
                      <button type="button" onClick={() => { onArchiveConversation(conversation.id); closeMenu(); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#222222]"><Archive className="h-5 w-5 text-[#A1A1AA]" /><span className="text-[12px] text-[#E5E7EB]">أرشفة</span></button>
                      <button type="button" onClick={() => { if (window.confirm('هل تريد حذف هذه المحادثة؟')) onDeleteConversation(conversation.id); closeMenu(); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#222222]"><Trash2 className="h-5 w-5 text-[#F87171]" /><span className="text-[12px] text-[#F87171]">حذف</span></button>
                    </div>}
                  </div>
                </div>)}
              </div>;
            })}
            {GROUPS.every((group) => groupedConversations[group].length === 0) && <p className="px-2 py-3 text-[12px] text-[#777777]">{searchQuery ? 'لا توجد محادثات مطابقة.' : 'لا توجد محادثات بعد.'}</p>}
          </section>
        </div>

        <div className="space-y-3 border-t border-[#1F1F1F] px-3 py-3">
          <section className="rounded-2xl border border-[#2A2A2A] bg-[#171717] p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-[12px] text-[#8B8B8B]">الرصيد</span><span className="text-[14px] font-bold text-[#F5F5F5]">{balance.toLocaleString('en-US')}</span></div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2A2A2A]" role="progressbar" aria-label="الرصيد المتبقي" aria-valuemin={0} aria-valuemax={10000} aria-valuenow={Math.min(balance, 10000)}><div className="h-full rounded-full bg-[#FACC15]" style={{ width: `${Math.min(100, Math.max(0, balance / 100))}%` }} /></div>
            <button type="button" onClick={onUpgrade} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#FACC15]/50 bg-[#FACC15]/10 px-3 py-2 text-[14px] font-bold text-[#F5D76A] transition-colors hover:bg-[#FACC15]/15"><Sparkles className="h-5 w-5" />ترقية</button>
            <button type="button" onClick={() => { onNavigate('balance'); onClose(); }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12px] text-[#B4B4B4] hover:bg-[#222222]"><span className="text-[14px]">تفاصيل الرصيد</span></button>
          </section>
          <section className="space-y-1">
            <div className="px-2 pb-1 text-[14px] font-medium text-[#8B8B8B]">الحساب والإعدادات</div>
            <button type="button" onClick={() => { onNavigate('home'); onClose(); }} className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-[14px] text-[#E5E7EB] transition-colors ${currentScreen === 'home' ? activeItemClass : 'hover:bg-[#1D1D1D]'}`}><UserRound className="h-5 w-5 text-[#A1A1AA]" /><span>الحساب</span></button>
            <button type="button" onClick={() => { onNavigate('admin'); onClose(); }} className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-[14px] text-[#E5E7EB] transition-colors ${currentScreen === 'admin' ? activeItemClass : 'hover:bg-[#1D1D1D]'}`}><Settings className="h-5 w-5 text-[#A1A1AA]" /><span>إعدادات الإدارة</span></button>
          </section>
        </div>
      </aside>
    </div>
  );
};

export default Sidebar;
