import React, { useState } from 'react';
import { ScreenType, ChatMessage, TransactionRecord } from './types';
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
  {
    id: 'tx-1',
    title: 'استفسار مالي تنفيذي',
    type: 'chat',
    typeLabel: 'محادثة',
    points: 131,
    isCredit: false,
    time: '14:25',
    date: '9 نوفمبر 2026',
  },
  {
    id: 'tx-2',
    title: 'صياغة عقد تجاري',
    type: 'document',
    typeLabel: 'مستند',
    points: 280,
    isCredit: false,
    time: '11:40',
    date: '9 نوفمبر 2026',
  },
  {
    id: 'tx-3',
    title: 'شحن رصيد نقاط',
    type: 'recharge',
    typeLabel: 'شحن رصيد',
    points: 5000,
    isCredit: true,
    time: '09:15',
    date: '9 نوفمبر 2026',
  },
  {
    id: 'tx-4',
    title: 'تحليل موازنة سنوية',
    type: 'chat',
    typeLabel: 'محادثة',
    points: 420,
    isCredit: false,
    time: '18:10',
    date: '8 نوفمبر 2026',
  },
  {
    id: 'tx-5',
    title: 'توليد رسم بياني',
    type: 'image',
    typeLabel: 'صورة',
    points: 350,
    isCredit: false,
    time: '15:30',
    date: '8 نوفمبر 2026',
  },
  {
    id: 'tx-6',
    title: 'تدقيق شروط الخدمة',
    type: 'document',
    typeLabel: 'مستند',
    points: 195,
    isCredit: false,
    time: '10:05',
    date: '8 نوفمبر 2026',
  },
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [balance, setBalance] = useState<number>(9850);
  const [currentPlan, setCurrentPlan] = useState<string>('Free');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(INITIAL_TRANSACTIONS);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modals
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState<boolean>(false);
  const [isRechargeOpen, setIsRechargeOpen] = useState<boolean>(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState<boolean>(false);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    const isFirst = messages.length === 0;

    setMessages((prev) => [...prev, userMsg]);
    if (currentScreen !== 'chat') {
      setCurrentScreen('chat');
    }
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), isFirstMessage: isFirst }),
      });

      const data = await response.json();
      const cost = data.cost || 12;
      const updatedBalance = Math.max(0, balance - cost);
      setBalance(updatedBalance);

      const assistantMsg: ChatMessage = {
        id: `msg-resp-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || 'تم استلام استفسارك بنجاح.',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        cost,
        remaining: updatedBalance,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Add debit transaction to history
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const newTx: TransactionRecord = {
        id: `tx-${Date.now()}`,
        title: summarizeTitle(text),
        type: 'chat',
        typeLabel: 'محادثة',
        points: cost,
        isCredit: false,
        time: timeStr,
        date: '9 نوفمبر 2026',
      };
      setTransactions((prev) => [newTx, ...prev]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const cost = 12;
      const updatedBalance = Math.max(0, balance - cost);
      setBalance(updatedBalance);

      const fallbackText = isFirst
        ? `أهلاً بك.\n\nالخطة المقترحة:\n\n* مراجعة متطلبات الموضوع.\n* تحديد الأولويات والجدول الزمني.\n* إعداد التقرير للاعتماد.`
        : `الخطة المقترحة:\n\n* مراجعة متطلبات الموضوع.\n* تحديد الأولويات والجدول الزمني.\n* إعداد التقرير للاعتماد.`;

      const assistantMsg: ChatMessage = {
        id: `msg-resp-${Date.now()}`,
        sender: 'assistant',
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        cost,
        remaining: updatedBalance,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecharge = (points: number, title: string) => {
    const newBalance = balance + points;
    setBalance(newBalance);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const rechargeTx: TransactionRecord = {
      id: `tx-rech-${Date.now()}`,
      title: 'شحن رصيد نقاط', // 3 words max
      type: 'recharge',
      typeLabel: 'شحن رصيد',
      points,
      isCredit: true,
      time: timeStr,
      date: '9 نوفمبر 2026',
    };
    setTransactions((prev) => [rechargeTx, ...prev]);
  };

  const handleUpgrade = (planName: string) => {
    setCurrentPlan(planName);
    handleRecharge(25000, 'ترقية باقة أعمال');
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentScreen('home');
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#F5F5F5] flex flex-col justify-between selection:bg-[#0EA5E9] selection:text-white">
      {/* Top Header */}
      <Header
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        onOpenMenu={() => setIsSidebarOpen(true)}
        balance={balance}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-between w-full overflow-hidden">
        {currentScreen === 'home' && (
          <HomeView
            onSelectPrompt={handleSendMessage}
            onOpenTaskSheet={() => setIsTaskSheetOpen(true)}
          />
        )}

        {currentScreen === 'chat' && (
          <ChatView
            messages={messages}
            isLoading={isLoading}
            balance={balance}
          />
        )}

        {currentScreen === 'balance' && (
          <BalanceView
            balance={balance}
            transactions={transactions}
            onOpenRecharge={() => setIsRechargeOpen(true)}
            onOpenUpgrade={() => setIsUpgradeOpen(true)}
            planName={currentPlan}
          />
        )}
      </main>

      {/* Bottom Input Bar (displayed on Home and Chat screens) */}
      {currentScreen !== 'balance' && (
        <BottomInputBar
          onSendMessage={handleSendMessage}
          onOpenTaskSheet={() => setIsTaskSheetOpen(true)}
          onOpenRecharge={() => setIsRechargeOpen(true)}
          balance={balance}
          isLoading={isLoading}
        />
      )}

      {/* Modals & Drawers */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNavigate={(screen) => setCurrentScreen(screen)}
        onNewChat={handleNewChat}
        balance={balance}
      />

      <TaskSheet
        isOpen={isTaskSheetOpen}
        onClose={() => setIsTaskSheetOpen(false)}
        onSelectTask={handleSendMessage}
      />

      <RechargeModal
        isOpen={isRechargeOpen}
        onClose={() => setIsRechargeOpen(false)}
        onConfirmRecharge={handleRecharge}
      />

      <UpgradeModal
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
        onUpgradePlan={handleUpgrade}
      />
    </div>
  );
}

// Helper to keep transaction title strictly to 3 words as requested
function summarizeTitle(text: string): string {
  const clean = text.replace(/[^\u0621-\u064A\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    return `${words[0]} ${words[1]} ${words[2]}`;
  }
  if (words.length === 2) {
    return `${words[0]} ${words[1]} تنفيذية`;
  }
  return 'استفسار ذكي مخصص';
}
