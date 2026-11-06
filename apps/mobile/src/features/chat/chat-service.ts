import { supabase } from "../lib/supabase/client";
import { env } from "../../config/env";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  modelId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  modelId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatService {
  // Authentication
  getCurrentUser: () => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<any>;

  // Conversations
  createConversation: (title?: string, modelId?: string) => Promise<Conversation | null>;
  getConversations: () => Promise<Conversation[]>;
  getConversation: (conversationId: string) => Promise<Conversation | null>;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;

  // Messages
  sendMessage: (content: string, conversationId: string, modelId?: string) => Promise<Message | null>;
  getMessages: (conversationId: string) => Promise<Message[]>;
  subscribeToMessages: (
    conversationId: string,
    onMessage: (message: Message) => void,
    onError: (error: Error) => void
  ) => () => void;
  sendSseMessage: (
    content: string,
    conversationId: string,
    modelId?: string,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (error: Error) => void
  ) => AbortController;
}

export interface Conversation {
  id: string;
  title: string;
  modelId?: string;
  createdAt: string;
  updatedAt: string;
}