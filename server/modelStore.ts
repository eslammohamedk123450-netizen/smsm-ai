import fs from 'node:fs';
import path from 'node:path';
import type {
  ExecutionMode,
  GranularCapabilityKey,
  ModelConfig,
  ModelTaskRole,
  PlanTier,
  RouterPolicySettings,
} from '../src/types.ts';

const CONFIG_PATH = path.resolve(process.cwd(), '.suly-admin-config.json');

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: 1,
    name: 'Suly Fast Planner (Hydrogen)',
    provider: 'google-genai',
    modelIdentifier: 'gemini-4-hydrogen',
    enabled: true,
    priority: 100,
    routingGroup: 'free_race',
    allowedModes: ['chat', 'agent'],
    taskRoles: ['planner', 'general'],
    allowedTiers: ['Free', 'Business Pro', 'Enterprise'],
    capabilities: {
      chat: true,
      read: true,
      write: false,
      vision: true,
      audio: true,
      convert: true,
      tools: true,
      pdf: true,
      word: true,
      video: false,
      gmail: true,
      google_drive: true,
      github: true,
    },
    responseTimeoutMs: 15000,
    description: 'نموذج سريع للتحليل الأولي وتوجيه الطلبات والمحادثة الفورية.',
  },
  {
    id: 2,
    name: 'Suly Agent Analyst & Gmail Summarizer',
    provider: 'google-genai',
    modelIdentifier: 'gemini-4-hydrogen',
    enabled: true,
    priority: 95,
    routingGroup: 'free_race',
    allowedModes: ['agent'],
    taskRoles: ['summarizer', 'executor'],
    allowedTiers: ['Free', 'Business Pro', 'Enterprise'],
    capabilities: {
      chat: true,
      read: true,
      write: true,
      vision: true,
      audio: true,
      convert: true,
      tools: true,
      pdf: true,
      word: true,
      video: true,
      gmail: true,
      google_drive: true,
      github: true,
    },
    responseTimeoutMs: 30000,
    description: 'مخصص للوكيل الذكي وقراءة وتلخيص رسائل Gmail واستخلاص الشركات والبيانات.',
  },
  {
    id: 3,
    name: 'Suly Ultra-Lite Express',
    provider: 'google-genai',
    modelIdentifier: 'gemini-3.1-flash-lite',
    enabled: true,
    priority: 80,
    routingGroup: 'free_race',
    allowedModes: ['chat'],
    taskRoles: ['general'],
    allowedTiers: ['Free', 'Business Pro', 'Enterprise'],
    capabilities: {
      chat: true,
      read: true,
      write: false,
      vision: false,
      audio: false,
      convert: true,
      tools: false,
      pdf: false,
      word: false,
      video: false,
      gmail: false,
      google_drive: false,
      github: false,
    },
    responseTimeoutMs: 10000,
    description: 'استجابة فائقة السرعة لوضع المحادثة العادية والنصوص المباشرة.',
  },
  {
    id: 4,
    name: 'Suly Executive Deep Reasoning',
    provider: 'google-genai',
    modelIdentifier: 'gemini-4-hydrogen',
    enabled: true,
    priority: 90,
    routingGroup: 'paid_fallback',
    allowedModes: ['chat', 'agent'],
    taskRoles: ['planner', 'executor', 'summarizer'],
    allowedTiers: ['Business Pro', 'Enterprise'],
    capabilities: {
      chat: true,
      read: true,
      write: true,
      vision: true,
      audio: true,
      convert: true,
      tools: true,
      pdf: true,
      word: true,
      video: true,
      gmail: true,
      google_drive: true,
      github: true,
    },
    responseTimeoutMs: 45000,
    description: 'نموذج متقدم لباقات الأعمال والمؤسسات لتحليل المهام المركبة والتقارير.',
  },
];

export const DEFAULT_POLICY: RouterPolicySettings = {
  gmailTaskModelId: 2,
  agentPlannerModelId: 1,
  agentSummarizerModelId: 2,
  freeRaceTimeoutMs: 8000,
  paidFallbackTimeoutMs: 30000,
  maxParallelFreeModels: 6,
  paidFallbackEnabled: true,
  autoRestrictEnabled: true,
};

interface PersistedAdminState {
  models: ModelConfig[];
  policy: RouterPolicySettings;
}

function readDiskState(): PersistedAdminState {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (raw && Array.isArray(raw.models) && raw.policy) {
        return {
          models: raw.models,
          policy: { ...DEFAULT_POLICY, ...raw.policy },
        };
      }
    }
  } catch {
    // Fall back to defaults cleanly
  }
  return {
    models: structuredClone(DEFAULT_MODELS),
    policy: { ...DEFAULT_POLICY },
  };
}

let state: PersistedAdminState = readDiskState();

function persistDiskState() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // Ignore read-only fs environments
  }
}

export function getAdminCatalogState(): PersistedAdminState {
  return {
    models: structuredClone(state.models),
    policy: { ...state.policy },
  };
}

export function updateModelConfig(
  id: number,
  patch: Partial<Omit<ModelConfig, 'id'>>
): ModelConfig | null {
  const index = state.models.findIndex((m) => m.id === id);
  if (index === -1) return null;
  const current = state.models[index];
  const updated: ModelConfig = {
    ...current,
    ...patch,
    capabilities: patch.capabilities
      ? { ...current.capabilities, ...patch.capabilities }
      : current.capabilities,
  };
  state.models[index] = updated;
  persistDiskState();
  return structuredClone(updated);
}

export function createModelConfig(input: Omit<ModelConfig, 'id'>): ModelConfig {
  const nextId = state.models.reduce((max, m) => Math.max(max, m.id), 0) + 1;
  const created: ModelConfig = { ...input, id: nextId };
  state.models.push(created);
  persistDiskState();
  return structuredClone(created);
}

export function updateRouterPolicy(
  patch: Partial<RouterPolicySettings>
): RouterPolicySettings {
  state.policy = { ...state.policy, ...patch };
  persistDiskState();
  return { ...state.policy };
}

export function selectEligibleModels(options: {
  mode: ExecutionMode;
  tier: PlanTier;
  requiredCapabilities?: GranularCapabilityKey[];
  preferredRole?: ModelTaskRole;
  preferredModelId?: number | null;
}): ModelConfig[] {
  const {
    mode,
    tier,
    requiredCapabilities = [],
    preferredRole,
    preferredModelId = null,
  } = options;

  const eligible = state.models.filter((model) => {
    if (!model.enabled || model.routingGroup === 'disabled') return false;
    if (!model.allowedModes.includes(mode)) return false;
    if (!model.allowedTiers.includes(tier)) return false;
    for (const cap of requiredCapabilities) {
      if (!model.capabilities[cap]) return false;
    }
    return true;
  });

  eligible.sort((a, b) => {
    if (preferredModelId && a.id === preferredModelId) return -1;
    if (preferredModelId && b.id === preferredModelId) return 1;
    if (preferredRole) {
      const aHasRole = a.taskRoles.includes(preferredRole) ? 1 : 0;
      const bHasRole = b.taskRoles.includes(preferredRole) ? 1 : 0;
      if (aHasRole !== bHasRole) return bHasRole - aHasRole;
    }
    return b.priority - a.priority;
  });

  return eligible;
}
