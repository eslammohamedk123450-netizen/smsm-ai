export type ScreenType = 'home' | 'chat' | 'balance' | 'admin';

export type ExecutionMode = 'chat' | 'agent';

export type ModelTaskRole = 'planner' | 'executor' | 'summarizer' | 'general';

export type PlanTier = 'Free' | 'Business Pro' | 'Enterprise';

export type GranularCapabilityKey =
  | 'chat'
  | 'read'
  | 'write'
  | 'vision'
  | 'audio'
  | 'convert'
  | 'tools'
  | 'pdf'
  | 'word'
  | 'video'
  | 'gmail'
  | 'google_drive'
  | 'github';

export type ModelCapabilitiesMap = Record<GranularCapabilityKey, boolean>;

export interface ModelConfig {
  id: number;
  name: string;
  provider: string;
  modelIdentifier: string;
  enabled: boolean;
  priority: number;
  routingGroup: 'free_race' | 'paid_fallback' | 'disabled';
  allowedModes: ExecutionMode[];
  taskRoles: ModelTaskRole[];
  allowedTiers: PlanTier[];
  capabilities: ModelCapabilitiesMap;
  responseTimeoutMs: number;
  description?: string;
}

export interface RouterPolicySettings {
  gmailTaskModelId: number | null;
  agentPlannerModelId: number | null;
  agentSummarizerModelId: number | null;
  freeRaceTimeoutMs: number;
  paidFallbackTimeoutMs: number;
  maxParallelFreeModels: number;
  paidFallbackEnabled: boolean;
  autoRestrictEnabled: boolean;
}

export type AgentStepKind =
  | 'connection_check'
  | 'planning'
  | 'model_route'
  | 'tool_call'
  | 'next_model_handoff'
  | 'confirmation'
  | 'final'
  | 'error';

export type AgentStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'requires_confirmation';

export interface AgentStep {
  id: string;
  index: number;
  kind: AgentStepKind;
  title: string;
  detail?: string;
  modelName?: string;
  tool?: string;
  status: AgentStepStatus;
  durationMs?: number;
}

export interface PendingConfirmation {
  requestId: string;
  tool: 'gmail_send_email' | 'gmail_reply_email' | 'gmail_modify_labels' | 'gmail_trash_message';
  actionLabel: string;
  summary: string;
  originalPrompt: string;
  preview: {
    to?: string;
    subject?: string;
    body?: string;
    messageId?: string;
    labelsToAdd?: string[];
    labelsToRemove?: string[];
  };
}

export interface GmailConnectionState {
  connected: boolean;
  source: 'gmail_oauth' | 'composio' | 'none';
  email: string | null;
  composioConfigured: boolean;
  checkedAt: string | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  cost?: number;
  remaining?: number;
  mode?: ExecutionMode;
  modelUsed?: string;
  agentSteps?: AgentStep[];
  needsGmailConnect?: boolean;
  pendingConfirmation?: PendingConfirmation;
  confirmationResolved?: 'confirmed' | 'cancelled';
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
