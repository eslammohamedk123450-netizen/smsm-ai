import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Cpu,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  ExecutionMode,
  GranularCapabilityKey,
  ModelCapabilitiesMap,
  ModelConfig,
  ModelTaskRole,
  PlanTier,
  RouterPolicySettings,
} from '../types';

interface AdminSettingsViewProps {
  onBack: () => void;
}

interface ComposioStatus {
  configured: boolean;
  updated_at: string | null;
}

const CAPABILITY_LABELS: Array<{ key: GranularCapabilityKey; label: string }> = [
  { key: 'chat', label: 'المحادثة' },
  { key: 'read', label: 'القراءة' },
  { key: 'write', label: 'الكتابة / التعديل' },
  { key: 'vision', label: 'الرؤية / الصور' },
  { key: 'audio', label: 'الاستماع / الصوت' },
  { key: 'convert', label: 'التحويل' },
  { key: 'tools', label: 'استدعاء الأدوات' },
  { key: 'pdf', label: 'PDF' },
  { key: 'word', label: 'Word' },
  { key: 'video', label: 'الفيديو' },
  { key: 'gmail', label: 'Gmail' },
  { key: 'google_drive', label: 'Google Drive' },
  { key: 'github', label: 'GitHub' },
];

const PLAN_TIERS: PlanTier[] = ['Free', 'Business Pro', 'Enterprise'];
const TASK_ROLES: Array<{ key: ModelTaskRole; label: string }> = [
  { key: 'planner', label: 'مخطط الوكيل (Planner)' },
  { key: 'executor', label: 'منفذ الأدوات (Executor)' },
  { key: 'summarizer', label: 'ملخص ومحلل (Summarizer)' },
  { key: 'general', label: 'محادثة عامة (General)' },
];

const EMPTY_CAPS: ModelCapabilitiesMap = {
  chat: true,
  read: true,
  write: false,
  vision: false,
  audio: false,
  convert: false,
  tools: false,
  pdf: false,
  word: false,
  video: false,
  gmail: false,
  google_drive: false,
  github: false,
};

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({ onBack }) => {
  const [status, setStatus] = useState<ComposioStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Models & Capabilities Matrix State
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [policy, setPolicy] = useState<RouterPolicySettings | null>(null);
  const [modeFilter, setModeFilter] = useState<'all' | ExecutionMode>('all');
  const [editingModelId, setEditingModelId] = useState<number | null>(null);
  const [savingModelId, setSavingModelId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add model fields
  const [newName, setNewName] = useState('');
  const [newIdentifier, setNewIdentifier] = useState('gemini-4-hydrogen');
  const [newModes, setNewModes] = useState<ExecutionMode[]>(['chat', 'agent']);
  const [newRoles, setNewRoles] = useState<ModelTaskRole[]>(['general']);
  const [newTiers, setNewTiers] = useState<PlanTier[]>(['Free', 'Business Pro', 'Enterprise']);
  const [newCaps, setNewCaps] = useState<ModelCapabilitiesMap>(EMPTY_CAPS);

  const getAccessToken = async () => {
    if (!supabase) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [composioRes, modelsRes] = await Promise.all([
        fetch('/api/admin/composio', { headers }),
        fetch('/api/admin/models'),
      ]);
      if (composioRes.ok) {
        setStatus(await composioRes.json());
      }
      if (modelsRes.ok) {
        const data = await modelsRes.json();
        setModels(data.models ?? []);
        setPolicy(data.policy ?? null);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر تحميل إعدادات لوحة التحكم.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const saveKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'اكتب مفتاح Composio أولاً.' });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('يجب تسجيل الدخول بحساب المدير في Supabase لحفظ مفتاح Vault.');
      const response = await fetch('/api/admin/composio', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر حفظ المفتاح.');
      setApiKey('');
      setStatus({ configured: true, updated_at: data.updated_at ?? new Date().toISOString() });
      setMessage({
        type: 'success',
        text: 'تم حفظ مفتاح Composio داخل Vault بنجاح. لن يتم عرضه مرة أخرى.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر حفظ المفتاح.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const patchModel = async (id: number, patch: Partial<ModelConfig>) => {
    setSavingModelId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/models/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر تحديث إعدادات النموذج.');
      setModels((prev) => prev.map((m) => (m.id === id ? data.model : m)));
      setMessage({ type: 'success', text: `تم تحديث قدرات وصلاحيات "${data.model.name}".` });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تحديث النموذج.',
      });
    } finally {
      setSavingModelId(null);
    }
  };

  const savePolicy = async (patch: Partial<RouterPolicySettings>) => {
    setMessage(null);
    try {
      const res = await fetch('/api/admin/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر تحديث سياسة التوجيه.');
      setPolicy(data.policy);
      setMessage({ type: 'success', text: 'تم تحديث النماذج المخصصة للمهام.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تحديث السياسة.',
      });
    }
  };

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newIdentifier.trim()) return;
    setMessage(null);
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          modelIdentifier: newIdentifier.trim(),
          provider: 'google-genai',
          enabled: true,
          priority: 85,
          routingGroup: 'free_race',
          allowedModes: newModes,
          taskRoles: newRoles,
          allowedTiers: newTiers,
          capabilities: newCaps,
          responseTimeoutMs: 20000,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر إضافة النموذج.');
      setModels((prev) => [...prev, data.model]);
      setShowAddForm(false);
      setNewName('');
      setMessage({ type: 'success', text: `تمت إضافة النموذج "${data.model.name}" بنجاح.` });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر إضافة النموذج.',
      });
    }
  };

  const toggleArrayValue = <T,>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const visibleModels = models.filter(
    (m) => modeFilter === 'all' || m.allowedModes.includes(modeFilter)
  );

  return (
    <section
      dir="rtl"
      className="flex-1 w-full overflow-y-auto custom-scrollbar mx-auto max-w-4xl px-4 py-6 text-[#F5F5F5] space-y-6"
    >
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-white cursor-pointer"
        >
          <ArrowRight className="h-5 w-5" />
          العودة
        </button>
      </div>

      <div className="flex items-start gap-4">
        <div className="rounded-2xl border border-[#164E63] bg-[#082F49] p-3">
          <ShieldCheck className="h-7 w-7 text-[#38BDF8]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">لوحة تحكم الإدارة والنماذج</h1>
          <p className="mt-1 text-sm text-[#A1A1AA]">
            تحديد قدرات كل نموذج (قراءة، كتابة، صوت، رؤية، تحويل، أدوات)، والأوضاع (محادثة / وكيل)، والباقات المسموحة.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
            message.type === 'success'
              ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300'
              : 'border-red-900/60 bg-red-950/30 text-red-300'
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* 1. Task-Specific Model Assignment (Planner / Gmail / Summarizer) */}
      {policy && (
        <div className="rounded-2xl border border-[#262626] bg-[#111111] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="h-5 w-5 text-[#0EA5E9]" />
            <h2 className="text-[16px] font-bold">تخصيص النماذج لمراحل الوكيل وGmail</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block text-xs text-[#A1A1AA] space-y-1.5">
              <span>نموذج التحليل والتخطيط (Planner)</span>
              <select
                value={policy.agentPlannerModelId ?? ''}
                onChange={(e) =>
                  void savePolicy({
                    agentPlannerModelId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full h-10 rounded-xl border border-[#262626] bg-[#0B0B0B] px-3 text-sm text-white outline-none focus:border-[#0EA5E9]"
              >
                <option value="">تلقائي حسب الأولوية</option>
                {models
                  .filter((m) => m.allowedModes.includes('agent'))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block text-xs text-[#A1A1AA] space-y-1.5">
              <span>نموذج مهام Gmail المخصص</span>
              <select
                value={policy.gmailTaskModelId ?? ''}
                onChange={(e) =>
                  void savePolicy({
                    gmailTaskModelId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full h-10 rounded-xl border border-[#262626] bg-[#0B0B0B] px-3 text-sm text-white outline-none focus:border-[#0EA5E9]"
              >
                <option value="">تلقائي حسب قدرة Gmail</option>
                {models
                  .filter((m) => m.capabilities.gmail)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block text-xs text-[#A1A1AA] space-y-1.5">
              <span>نموذج التلخيص والمرحلة التالية</span>
              <select
                value={policy.agentSummarizerModelId ?? ''}
                onChange={(e) =>
                  void savePolicy({
                    agentSummarizerModelId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full h-10 rounded-xl border border-[#262626] bg-[#0B0B0B] px-3 text-sm text-white outline-none focus:border-[#0EA5E9]"
              >
                <option value="">تلقائي حسب الدور</option>
                {models
                  .filter((m) => m.allowedModes.includes('agent'))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* 2. Models, Modes, Capabilities & Package Tiers */}
      <div className="rounded-2xl border border-[#262626] bg-[#111111] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Cpu className="h-5 w-5 text-[#0EA5E9]" />
            <div>
              <h2 className="text-[16px] font-bold">النماذج المتاحة وقدراتها والباقات</h2>
              <p className="text-xs text-[#8B8B8B]">
                تحكم كامل في ظهور كل نموذج في المحادثة أو الوكيل، وقدراته، والباقات المسموحة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0B0B0B] border border-[#262626]">
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'chat', label: 'المحادثة' },
                  { id: 'agent', label: 'الوكيل' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setModeFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    modeFilter === tab.id
                      ? 'bg-[#262626] text-white'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة نموذج</span>
            </button>
          </div>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleCreateModel}
            className="rounded-xl border border-[#0EA5E9]/40 bg-[#0B0B0B] p-4 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-[#A1A1AA] space-y-1">
                <span>اسم النموذج</span>
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: Suly Gmail Specialist"
                  className="w-full h-10 rounded-xl border border-[#262626] bg-[#141414] px-3 text-sm text-white outline-none focus:border-[#0EA5E9]"
                />
              </label>
              <label className="text-xs text-[#A1A1AA] space-y-1">
                <span>المعرف التقني (Model ID)</span>
                <select
                  value={newIdentifier}
                  onChange={(e) => setNewIdentifier(e.target.value)}
                  className="w-full h-10 rounded-xl border border-[#262626] bg-[#141414] px-3 text-sm text-white font-mono outline-none focus:border-[#0EA5E9]"
                >
                  <option value="gemini-4-hydrogen">gemini-4-hydrogen</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              <div className="space-y-1.5">
                <div className="text-[#8B8B8B]">الوضع المسموح:</div>
                <div className="flex gap-2">
                  {(['chat', 'agent'] as ExecutionMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setNewModes((prev) => toggleArrayValue(prev, mode))}
                      className={`px-3 py-1.5 rounded-lg border cursor-pointer ${
                        newModes.includes(mode)
                          ? 'bg-[#0EA5E9]/20 border-[#0EA5E9] text-[#38BDF8]'
                          : 'bg-[#141414] border-[#262626] text-[#A1A1AA]'
                      }`}
                    >
                      {mode === 'chat' ? 'المحادثة' : 'الوكيل (Agent)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[#8B8B8B]">الباقات المسموحة:</div>
                <div className="flex flex-wrap gap-2">
                  {PLAN_TIERS.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setNewTiers((prev) => toggleArrayValue(prev, tier))}
                      className={`px-3 py-1.5 rounded-lg border cursor-pointer ${
                        newTiers.includes(tier)
                          ? 'bg-emerald-950/50 border-emerald-700 text-emerald-300'
                          : 'bg-[#141414] border-[#262626] text-[#A1A1AA]'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="text-[#8B8B8B]">القدرات:</div>
              <div className="flex flex-wrap gap-2">
                {CAPABILITY_LABELS.map((cap) => (
                  <button
                    key={cap.key}
                    type="button"
                    onClick={() =>
                      setNewCaps((prev) => ({ ...prev, [cap.key]: !prev[cap.key] }))
                    }
                    className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                      newCaps[cap.key]
                        ? 'bg-[#0EA5E9]/15 border-[#0EA5E9]/60 text-white'
                        : 'bg-[#141414] border-[#262626] text-[#71717A]'
                    }`}
                  >
                    {cap.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200 cursor-pointer"
              >
                حفظ النموذج الجديد
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-xl bg-[#262626] text-white text-xs font-bold hover:bg-[#333333] cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-[#1F1F1F] border border-[#262626] rounded-xl overflow-hidden bg-[#0B0B0B]">
          {visibleModels.map((model) => {
            const isExpanded = editingModelId === model.id;
            const activeCapsCount = Object.values(model.capabilities).filter(Boolean).length;

            return (
              <div key={model.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-[#0EA5E9] shrink-0" />
                      <span className="font-bold text-[14px] text-white">{model.name}</span>
                      <span className="text-[11px] font-mono text-[#71717A]">
                        {model.modelIdentifier}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] text-[#A1A1AA] flex flex-wrap items-center gap-1.5">
                      <span>
                        الأوضاع:{' '}
                        {model.allowedModes
                          .map((m) => (m === 'chat' ? 'محادثة' : 'وكيل'))
                          .join(' + ')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>الباقات: {model.allowedTiers.join(' / ')}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{activeCapsCount} قدرة مفعلة</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={savingModelId === model.id}
                      onClick={() => void patchModel(model.id, { enabled: !model.enabled })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        model.enabled
                          ? 'bg-emerald-950/40 border-emerald-800/70 text-emerald-300'
                          : 'bg-[#1A1A1A] border-[#262626] text-[#71717A]'
                      }`}
                    >
                      {model.enabled ? 'مفعّل' : 'معطّل'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingModelId(isExpanded ? null : model.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1F1F1F] hover:bg-[#262626] text-white border border-[#262626] cursor-pointer"
                    >
                      {isExpanded ? 'إغلاق التعديل' : 'تخصيص القدرات'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="pt-3 border-t border-[#1F1F1F] space-y-4 text-xs">
                    {/* Modes */}
                    <div>
                      <div className="text-[#8B8B8B] mb-1.5 font-semibold">
                        النظام المسموح للنموذج:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(['chat', 'agent'] as ExecutionMode[]).map((mode) => {
                          const active = model.allowedModes.includes(mode);
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() =>
                                void patchModel(model.id, {
                                  allowedModes: toggleArrayValue(model.allowedModes, mode),
                                })
                              }
                              className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${
                                active
                                  ? 'bg-[#0EA5E9]/20 border-[#0EA5E9] text-[#38BDF8]'
                                  : 'bg-[#141414] border-[#262626] text-[#8B8B8B]'
                              }`}
                            >
                              {mode === 'chat' ? 'وضع المحادثة (Chat)' : 'وضع الوكيل (Agent)'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Task Roles */}
                    <div>
                      <div className="text-[#8B8B8B] mb-1.5 font-semibold">
                        الدور داخل منظومة الوكيل:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {TASK_ROLES.map((role) => {
                          const active = model.taskRoles.includes(role.key);
                          return (
                            <button
                              key={role.key}
                              type="button"
                              onClick={() =>
                                void patchModel(model.id, {
                                  taskRoles: toggleArrayValue(model.taskRoles, role.key),
                                })
                              }
                              className={`px-3 py-1.5 rounded-lg border cursor-pointer ${
                                active
                                  ? 'bg-white text-black border-white font-bold'
                                  : 'bg-[#141414] border-[#262626] text-[#A1A1AA]'
                              }`}
                            >
                              {role.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Allowed Tiers */}
                    <div>
                      <div className="text-[#8B8B8B] mb-1.5 font-semibold">
                        الباقات المسموح لها باستخدام النموذج:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {PLAN_TIERS.map((tier) => {
                          const active = model.allowedTiers.includes(tier);
                          return (
                            <button
                              key={tier}
                              type="button"
                              onClick={() =>
                                void patchModel(model.id, {
                                  allowedTiers: toggleArrayValue(model.allowedTiers, tier),
                                })
                              }
                              className={`px-3 py-1.5 rounded-lg border cursor-pointer ${
                                active
                                  ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300 font-bold'
                                  : 'bg-[#141414] border-[#262626] text-[#A1A1AA]'
                              }`}
                            >
                              {tier}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Granular Capabilities */}
                    <div>
                      <div className="text-[#8B8B8B] mb-1.5 font-semibold">
                        القدرات التفصيلية للنموذج (قراءة، كتابة، صوت، رؤية، تحويل، تطبيقات):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {CAPABILITY_LABELS.map((cap) => {
                          const active = model.capabilities[cap.key];
                          return (
                            <button
                              key={cap.key}
                              type="button"
                              onClick={() =>
                                void patchModel(model.id, {
                                  capabilities: {
                                    ...model.capabilities,
                                    [cap.key]: !active,
                                  },
                                })
                              }
                              className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                active
                                  ? 'bg-[#0EA5E9]/15 border-[#0EA5E9]/60 text-white font-bold'
                                  : 'bg-[#141414] border-[#262626] text-[#71717A]'
                              }`}
                            >
                              {cap.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Existing Composio Vault Configuration Card */}
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#151515] p-5 shadow-xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-[#38BDF8]" />
            <div>
              <h2 className="font-semibold">Composio Platform API Key</h2>
              <p className="mt-1 text-xs text-[#8B8B8B]">
                يُستخدم لإنشاء جلسات وأدوات المستخدمين عبر Supabase Vault.
              </p>
            </div>
          </div>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#8B8B8B]" />
          ) : status?.configured ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              مُضاف
            </span>
          ) : (
            <span className="text-xs text-amber-400">غير مُضاف</span>
          )}
        </div>
        <form onSubmit={saveKey} className="space-y-4">
          <label className="block text-sm text-[#D4D4D8]">
            المفتاح
            <input
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={status?.configured ? 'أدخل مفتاحاً جديداً للاستبدال' : 'ak_...'}
              className="mt-2 h-12 w-full rounded-xl border border-[#333] bg-[#0D0D0D] px-4 text-left text-sm text-white outline-none placeholder:text-[#666] focus:border-[#38BDF8]"
            />
          </label>
          <p className="text-xs leading-5 text-[#8B8B8B]">
            لن يتم حفظ المفتاح في المتصفح أو Git. الحفظ يستبدل المفتاح السابق داخل Supabase Vault، ولا تعرض الشاشة القيمة الحالية.
          </p>
          <button
            disabled={isSaving}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0EA5E9] font-bold text-white transition hover:bg-[#0284C7] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {isSaving && <Loader2 className="h-5 w-5 animate-spin" />}
            حفظ المفتاح بشكل آمن
          </button>
        </form>
      </div>
    </section>
  );
};
