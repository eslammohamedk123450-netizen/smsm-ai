import React, { useEffect, useState } from 'react';
import {
  ScreenType,
  ChatMessage,
  TransactionRecord,
  ConversationRecord,
  ExecutionMode,
  AgentStep,
  PendingConfirmation,
  GmailConnectionState,
  PlanTier,
} from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { ChatView } from './components/ChatView';
import { BalanceView } from './components/BalanceView';
import { BottomInputBar } from './components/BottomInputBar';
import { TaskSheet } from './components/TaskSheet';
import { RechargeModal } from './components/RechargeModal';
import { UpgradeModal } from './components/UpgradeModal';
import { AdminSettingsView } from './components/AdminSettingsView';
import { SplashLoader } from './components/SplashLoader';
import {
  connectGmail,
  getGmailAccessToken,
  getGmailCachedEmail,
  initGmailAuth,
} from './lib/gmailAuth';

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
    return Array.isArray(data)
      ? data.filter((item) => item && typeof item.id === 'string' && Array.isArray(item.messages))
      : [];
  } catch {
    return [];
  }
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('agent');
  const [balance, setBalance] = useState<number>(9850);
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('Free');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationRecord[]>(loadConversations);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(INITIAL_TRANSACTIONS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [liveSteps, setLiveSteps] = useState<AgentStep[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState<boolean>(false);
  const [isRechargeOpen, setIsRechargeOpen] = useState<boolean>(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState<boolean>(false);

  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [gmailNotice, setGmailNotice] = useState<string | null>(null);
  const [gmailConnection, setGmailConnection] = useState<GmailConnectionState>({
    connected: false,
    source: 'none',
    email: null,
    composioConfigured: false,
    checkedAt: null,
  });

  const refreshLiveConnectionStatus = async (tokenOverride?: string | null) => {
    try {
      const token = tokenOverride !== undefined ? tokenOverride : getGmailAccessToken();
      const res = await fetch('/api/integrations/status', {
        headers: token ? { 'x-gmail-token': token } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      setGmailConnection({
        connected: data.gmail?.connected === true,
        source: data.gmail?.source ?? 'none',
        email: data.gmail?.email ?? getGmailCachedEmail(),
        composioConfigured: data.composio?.configured === true,
        checkedAt: new Date().toISOString(),
      });
    } catch {
      // Ignore transient network check errors
    }
  };

  useEffect(() => {
    const unsubscribe = initGmailAuth(
      (user, token) => {
        setGmailNotice(null);
        setGmailConnection((prev) => ({
          ...prev,
          connected: true,
          source: 'gmail_oauth',
          email: user.email ?? prev.email,
        }));
        void refreshLiveConnectionStatus(token);
      },
      () => {
        void refreshLiveConnectionStatus(null);
      }
    );
    void refreshLiveConnectionStatus();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    window.localStorage.setItem('suly:conversations', JSON.stringify(conversations));
  }, [conversations]);

  const handleConnectGmail = async () => {
    if (isConnectingGmail) return;
    setIsConnectingGmail(true);
    setGmailNotice(null);
    try {
      const result = await connectGmail();
      if (!result.ok) {
        setGmailNotice(result.message);
        return;
      }
      setGmailNotice(null);
      setGmailConnection({
        connected: true,
        source: 'gmail_oauth',
        email: result.email,
        composioConfigured: gmailConnection.composioConfigured,
        checkedAt: new Date().toISOString(),
      });
      await refreshLiveConnectionStatus(result.accessToken);
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const streamRouterRequest = async (payload: {
    conversationId: string;
    history: ChatMessage[];
    mode: ExecutionMode;
    titleSource: string;
    confirmAction?: {
      requestId: string;
      approved: boolean;
      pendingConfirmation: PendingConfirmation;
    };
  }) => {
    setIsLoading(true);
    setLiveSteps([]);

    const stepMap = new Map<string, AgentStep>();
    let streamedText = '';
    let modelUsed = '';
    let finalCost = 10;
    let needsGmailConnect = false;
    let pendingConfirmation: PendingConfirmation | undefined;

    const appendAssistantMessage = (assistantMsg: ChatMessage) => {
      setMessages((previous) => {
        const updated = [...previous, assistantMsg];
        setConversations((items) =>
          items.map((item) =>
            item.id === payload.conversationId
              ? { ...item, messages: updated, updatedAt: new Date().toISOString() }
              : item
          )
        );
        return updated;
      });
    };

    try {
      const gmailToken = getGmailAccessToken();
      const response = await fetch('/api/ai-router', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(gmailToken ? { 'x-gmail-token': gmailToken } : {}),
        },
        body: JSON.stringify({
          messages: payload.history.map((m) => ({ role: m.sender, text: m.text })),
          execution_mode: payload.mode,
          plan_tier: currentPlan,
          confirm_action: payload.confirmAction,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('تعذر الاتصال بخدمة التوجيه الذكي.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const rawEvent of events) {
          const line = rawEvent.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const evt = JSON.parse(jsonStr);
            if (evt.type === 'step' && evt.step) {
              stepMap.set(evt.step.id, evt.step);
              setLiveSteps(Array.from(stepMap.values()).sort((a, b) => a.index - b.index));
            } else if (evt.type === 'chunk' && typeof evt.chunk === 'string') {
              streamedText += evt.chunk;
            } else if (evt.type === 'needs_gmail') {
              needsGmailConnect = true;
            } else if (evt.type === 'confirmation' && evt.pendingConfirmation) {
              pendingConfirmation = evt.pendingConfirmation;
            } else if (evt.type === 'done') {
              modelUsed = evt.modelUsed || modelUsed;
              finalCost = typeof evt.cost === 'number' ? evt.cost : finalCost;
            } else if (evt.type === 'error') {
              streamedText = evt.error || 'تعذر تنفيذ الطلب.';
            }
          } catch {
            // Skip malformed partial frame
          }
        }
      }

      const updatedBalance = Math.max(0, balance - finalCost);
      setBalance(updatedBalance);
      const completedSteps = Array.from(stepMap.values()).sort((a, b) => a.index - b.index);

      appendAssistantMessage({
        id: `msg-resp-${Date.now()}`,
        sender: 'assistant',
        text:
          streamedText ||
          (pendingConfirmation
            ? 'يرجى مراجعة تفاصيل الإجراء أدناه وتأكيد التنفيذ للمتابعة.'
            : 'تم استلام طلبك ومعالجته.'),
        timestamp: new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        cost: finalCost,
        remaining: updatedBalance,
        mode: payload.mode,
        modelUsed,
        agentSteps: completedSteps,
        needsGmailConnect,
        pendingConfirmation,
      });

      const date = new Date();
      setTransactions((previous) => [
        {
          id: `tx-${Date.now()}`,
          title: summarizeTitle(payload.titleSource),
          type: 'chat',
          typeLabel: payload.mode === 'agent' ? 'وكيل ذكي' : 'محادثة',
          points: finalCost,
          isCredit: false,
          time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          date: date.toLocaleDateString('ar-EG'),
        },
        ...previous,
      ]);
    } catch (error) {
      console.error('Failed to run router:', error);
      const cost = 0;
      appendAssistantMessage({
        id: `msg-err-${Date.now()}`,
        sender: 'assistant',
        text: 'تعذر الاتصال بخدمة المعالجة الآن. يرجى المحاولة مرة أخرى.',
        timestamp: new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        cost,
        remaining: balance,
        mode: payload.mode,
      });
    } finally {
      setIsLoading(false);
      setLiveSteps([]);
    }
  };

  const handleSendMessage = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || isLoading) return;

    const conversationId = currentConversationId || `chat-${Date.now()}`;
    const now = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setCurrentConversationId(conversationId);
    setMessages(nextMessages);
    setConversations((previous) => {
      const existing = previous.find((item) => item.id === conversationId);
      if (existing) {
        return previous.map((item) =>
          item.id === conversationId ? { ...item, messages: nextMessages, updatedAt: now } : item
        );
      }
      return [
        {
          id: conversationId,
          title: cleanText,
          createdAt: now,
          updatedAt: now,
          messages: nextMessages,
          pinned: false,
          archived: false,
        },
        ...previous,
      ];
    });
    if (currentScreen !== 'chat') setCurrentScreen('chat');

    await streamRouterRequest({
      conversationId,
      history: nextMessages,
      mode: executionMode,
      titleSource: cleanText,
    });
  };

  const handleConfirmAction = async (
    messageId: string,
    pending: PendingConfirmation,
    approved: boolean
  ) => {
    const conversationId = currentConversationId || `chat-${Date.now()}`;
    const updatedMessages = messages.map((m) =>
      m.id === messageId
        ? { ...m, confirmationResolved: approved ? ('confirmed' as const) : ('cancelled' as const) }
        : m
    );
    setMessages(updatedMessages);
    setConversations((items) =>
      items.map((item) =>
        item.id === conversationId
          ? { ...item, messages: updatedMessages, updatedAt: new Date().toISOString() }
          : item
      )
    );

    await streamRouterRequest({
      conversationId,
      history: updatedMessages,
      mode: 'agent',
      titleSource: pending.actionLabel,
      confirmAction: {
        requestId: pending.requestId,
        approved,
        pendingConfirmation: pending,
      },
    });
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
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === id ? { ...conversation, ...update } : conversation
      )
    );
  };

  const handleRecharge = (points: number, title: string) => {
    const newBalance = balance + points;
    setBalance(newBalance);
    const now = new Date();
    setTransactions((previous) => [
      {
        id: `tx-rech-${Date.now()}`,
        title: title || 'شحن رصيد نقاط',
        type: 'recharge',
        typeLabel: 'شحن رصيد',
        points,
        isCredit: true,
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString('ar-EG'),
      },
      ...previous,
    ]);
  };

  const handleUpgrade = (planName: string) => {
    const validPlan: PlanTier =
      planName === 'Business Pro' || planName === 'Enterprise' ? planName : 'Free';
    setCurrentPlan(validPlan);
    handleRecharge(25000, 'ترقية باقة أعمال');
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#F5F5F5] flex flex-col justify-between selection:bg-[#0EA5E9] selection:text-white">
      {showSplash && <SplashLoader onFinish={() => setShowSplash(false)} />}

      <Header
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        onOpenMenu={() => setIsSidebarOpen(true)}
        balance={balance}
      />

      <main className="flex-1 flex flex-col justify-between w-full overflow-hidden">
        {currentScreen === 'admin' && (
          <AdminSettingsView onBack={() => setCurrentScreen('home')} />
        )}
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
            liveSteps={liveSteps}
            balance={balance}
            onConnectGmail={handleConnectGmail}
            isConnectingGmail={isConnectingGmail}
            onConfirmAction={handleConfirmAction}
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

      {currentScreen !== 'balance' && currentScreen !== 'admin' && (
        <BottomInputBar
          onSendMessage={handleSendMessage}
          onOpenTaskSheet={() => setIsTaskSheetOpen(true)}
          onOpenRecharge={() => setIsRechargeOpen(true)}
          balance={balance}
          isLoading={isLoading}
          executionMode={executionMode}
          onChangeMode={setExecutionMode}
          gmailConnection={gmailConnection}
          onConnectGmail={handleConnectGmail}
          isConnectingGmail={isConnectingGmail}
          gmailNotice={gmailNotice}
          onDismissGmailNotice={() => setGmailNotice(null)}
        />
      )}

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNavigate={setCurrentScreen}
        onNewChat={handleNewChat}
        onSelectConversation={selectConversation}
        onRenameConversation={(id, title) => updateConversation(id, { title })}
        onTogglePin={(id) => {
          const conversation = conversations.find((item) => item.id === id);
          if (conversation) updateConversation(id, { pinned: !conversation.pinned });
        }}
        onArchiveConversation={(id) => updateConversation(id, { archived: true })}
        onDeleteConversation={(id) => {
          setConversations((previous) => previous.filter((item) => item.id !== id));
          if (currentConversationId === id) handleNewChat();
        }}
        onUpgrade={() => setIsUpgradeOpen(true)}
        conversations={conversations}
        currentConversationId={currentConversationId}
        balance={balance}
        currentScreen={currentScreen}
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

function summarizeTitle(text: string): string {
  const clean = text.replace(/[^\u0621-\u064A\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return `${words[0]} ${words[1]} ${words[2]}`;
  if (words.length === 2) return `${words[0]} ${words[1]} تنفيذية`;
  return clean || 'محادثة جديدة';
}
