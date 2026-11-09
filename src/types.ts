export type ScreenType = 'home' | 'chat' | 'balance';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  cost?: number;
  remaining?: number;
}

export type TransactionType = 'chat' | 'image' | 'document' | 'recharge';

export interface TransactionRecord {
  id: string;
  title: string; // 3 words max: e.g. "استفسار مالي تنفيذي"
  type: TransactionType;
  typeLabel: string; // "محادثة" | "صورة" | "مستند" | "شحن رصيد"
  points: number;
  isCredit: boolean; // true if recharge (+), false if consumption (-)
  time: string; // "14:25"
  date: string; // "9 نوفمبر 2026"
}

export interface TaskItem {
  id: string;
  icon: string;
  category: string;
  title: string;
  description: string;
  prompt: string;
}
