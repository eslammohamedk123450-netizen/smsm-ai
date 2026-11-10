import React, { useEffect, useState } from 'react';
import { ScreenType, ChatMessage, TransactionRecord, ConversationRecord } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { ChatView } from './components/ChatView';
import { BalanceView } from './components/BalanceView';
import { BottomInputBar } from './components/BottomInputBar';
import { TaskSheet } from './components/TaskSheet';
import { RechargeModal } from './components/RechargeModal';
import { UpgradeModal } from './components/UpgradeModal';

const INITIAL_TRANSACTIONS: TransactionRecord[] = [
  { id: 'tx-1', title: 'استفسار مالي تنفيذي', type: 'chat', typeLabel: 'محادثة', points: 131, isCredit: false, time: '14:25', date: '9 نوفمبر 2026' },
  { id: 'tx-2', title: 'صياغة عقد تجاري', type: 'document', typeLabel: 'مستند', points: 280, isCredit: false, time: '11:40', date: '9 نوفمبر 2026' },
  { id: 'tx-3', title: 'شحن رصيد نقاط', type: 'recharge', typeLabel: 'شحن رصيد', points: 5000, isCredit: true, time: '09:15', date: '9 نوفمبر 2026' },
  { id: 'tx-4', title: 'تحليل موازنة سنوية', type: 'chat', typeLabel: 'محادثة', points: 420, isCredit: false, time: '18:10', date: '8 نوفمبر 2026' },
  { id: 'tx-5', title: 'توليد رسم بياني', type: 'image', typeLabel: 'صورة', points: 350, isCredit: false, time: '15:30', date: '8 نوفمبر 2026' },
  { id: 'tx-6', title: 'تدقيق شروط الخدمة', type: 'document', typeLabel: 'مستند', points: 195, isCredit: false, time: '10:05', date: '8 نوفمبر 2026' },
];

const loadConversations = (): ConversationRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const data = JSON.parse(window.localStorage.getItem('suly:conversations') || '[]');
    return Array.isArray(data) ? data.filter((item) => item && typeof item.id === 'string' && Array.isArray(item.messages)) : [];
  } catch {
    return [];
  }
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [balance, setBalance] = useState<number>(9850);
  const [currentPlan, setCurrentPlan] = useState<string>('Free');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationRecord[]>(loadConversations);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(INITIAL_TRANSACTIONS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState<boolean>(false);
  const [isRechargeOpen, setIsRechargeOpen] = useState<boolean>(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState<boolean>(false);

  useEffect(() => {
    window.localStorage.setItem('suly:conversations', JSON.stringify(conversations));
  }, [conversations]);

  const handleSendMessage = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;

    const conversationId = currentConversationId || `chat-${Date.now()}`;
    const now = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };
    const isFirst = !currentConversationId || messages.length === 0;
    const nextMessages = [...messages, userMsg];
    setCurrentConversationId(conversationId);
    setMessages(nextMessages);
    setConversations((previous) => {
      const existing = previous.find((item) => item.id === conversationId);
      if (existing) return previous.map((item) => item.id === conversationId ? { ...item, messages: nextMessages, updatedAt: now } : item);
      return [{ id: conversationId, title: cleanText, createdAt: now, updatedAt: now, messages: nextMessages, pinned: false, archived: false }, ...previous];
    });
    if (currentScreen !== 'chat') setCurrentScreen('chat');
    setIsLoading(true);

    const appendAssistantMessage = (assistantMsg: ChatMessage) => {
      setMessages((previous) => {
        const updated = [...previous, assistantMsg];
        setConversations((items) => items.map((item) => item.id === conversationId ? { ...item, messages: updated, updatedAt: new Date().toISOString() } : item));
        return updated;
      });
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: cleanText, isFirstMessage: isFirst }),
      });
      if (!response.ok) throw new Error('تعذر الاتصال بخدمة المحادثة.');
      const data = await response.json();
      const cost = data.cost || 12;
      const updatedBalance = Math.max(0, balance - cost);
      setBalance(updatedBalance);
      appendAssistantMessage({ id: `msg-resp-${Date.now()}`, sender: 'assistant', text: data.reply || 'تم استلام استفسارك بنجاح.', timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }), cost, remaining: updatedBalance });
      const date = new Date();
      setTransactions((previous) => [{ id: `tx-${Date.now()}`, title: summarizeTitle(cleanText), type: 'chat', typeLabel: 'محادثة', points: cost, isCredit: false, time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), date: date.toLocaleDateString('ar-EG'), }, ...previous]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const cost = 12;
      const updatedBalance = Math.max(0, balance - cost);
      setBalance(updatedBalance);
      appendAssistantMessage({ id: `msg-resp-${Date.now()}`, sender: 'assistant', text: 'تعذر الاتصال بالخدمة الآن. يرجى المحاولة مرة أخرى بعد قليل.', timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }), cost, remaining: updatedBalance });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setCurrentScreen('home');
  };

  const selectConversation = (conversation: ConversationRecord) => {
    setCurrentConversationId(conversation.id);
    setMessages(conversation.messages);
    setCurrentScreen('chat');
  };

  const updateConversation = (id: string, update: Partial<ConversationRecord>) => {
    setConversations((previous) => previous.map((conversation) => conversation.id === id ? { ...conversation, ...update } : conversation));
  };

  const handleRecharge = (points: number, title: string) => {
    const newBalance = balance + points;
    setBalance(newBalance);
    const now = new Date();
    setTransactions((previous) => [{ id: `tx-rech-${Date.now()}`, title: title || 'شحن رصيد نقاط', type: 'recharge', typeLabel: 'شحن رصيد', points, isCredit: true, time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), date: now.toLocaleDateString('ar-EG') }, ...previous]);
  };

  const handleUpgrade = (planName: string) => {
    setCurrentPlan(planName);
    handleRecharge(25000, 'ترقية باقة أعمال');
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#F5F5F5] flex flex-col justify-between selection:bg-[#0EA5E9] selection:text-white">
      <Header currentScreen={currentScreen} onNavigate={setCurrentScreen} onOpenMenu={() => setIsSidebarOpen(true)} balance={balance} />
      <main className="flex-1 flex flex-col justify-between w-full overflow-hidden">
        {currentScreen === 'home' && <HomeView onSelectPrompt={handleSendMessage} onOpenTaskSheet={() => setIsTaskSheetOpen(true)} />}
        {currentScreen === 'chat' && <ChatView messages={messages} isLoading={isLoading} balance={balance} />}
        {currentScreen === 'balance' && <BalanceView balance={balance} transactions={transactions} onOpenRecharge={() => setIsRechargeOpen(true)} onOpenUpgrade={() => setIsUpgradeOpen(true)} planName={currentPlan} />}
      </main>
      {currentScreen !== 'balance' && <BottomInputBar onSendMessage={handleSendMessage} onOpenTaskSheet={() => setIsTaskSheetOpen(true)} onOpenRecharge={() => setIsRechargeOpen(true)} balance={balance} isLoading={isLoading} />}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNavigate={setCurrentScreen}
        onNewChat={handleNewChat}
        onSelectConversation={selectConversation}
        onRenameConversation={(id, title) => updateConversation(id, { title })}
        onTogglePin={(id) => { const conversation = conversations.find((item) => item.id === id); if (conversation) updateConversation(id, { pinned: !conversation.pinned }); }}
        onArchiveConversation={(id) => updateConversation(id, { archived: true })}
        onDeleteConversation={(id) => { setConversations((previous) => previous.filter((item) => item.id !== id)); if (currentConversationId === id) handleNewChat(); }}
        onUpgrade={() => setIsUpgradeOpen(true)}
        conversations={conversations}
        currentConversationId={currentConversationId}
        balance={balance}
        currentScreen={currentScreen}
      />
      <TaskSheet isOpen={isTaskSheetOpen} onClose={() => setIsTaskSheetOpen(false)} onSelectTask={handleSendMessage} />
      <RechargeModal isOpen={isRechargeOpen} onClose={() => setIsRechargeOpen(false)} onConfirmRecharge={handleRecharge} />
      <UpgradeModal isOpen={isUpgradeOpen} onClose={() => setIsUpgradeOpen(false)} onUpgradePlan={handleUpgrade} />
    </div>
  );
}

function summarizeTitle(text: string): string {
  const clean = text.replace(/[^\u0621-\u064A\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return `${words[0]} ${words[1]} ${words[2]}`;
  if (words.length === 2) return `${words[0]} ${words[1]} تنفيذية`;
  return clean || 'محادثة جديدة';
}
