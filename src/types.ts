export type ScreenType = 'home' | 'chat' | 'balance';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  cost?: number;
  remaining?: number;
}

export interface ConversationRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  pinned: boolean;
  archived: boolean;
}

export type TransactionType = 'chat' | 'image' | 'document' | 'recharge';

export interface TransactionRecord {
  id: string;
  title: string;
  type: TransactionType;
  typeLabel: string;
  points: number;
  isCredit: boolean;
  time: string;
  date: string;
}

export interface TaskItem {
  id: string;
  icon: string;
  category: string;
  title: string;
  description: string;
  prompt: string;
}
