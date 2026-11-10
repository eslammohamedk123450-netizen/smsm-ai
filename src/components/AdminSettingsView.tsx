import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, KeyRound, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AdminSettingsViewProps { onBack: () => void; }
interface ComposioStatus { configured: boolean; updated_at: string | null; }

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({ onBack }) => {
  const [status, setStatus] = useState<ComposioStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getAccessToken = async () => {
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة في بيئة التطبيق.');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('يجب تسجيل الدخول بحساب المدير أولاً.');
    return session.access_token;
  };

  const loadStatus = async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/composio', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر قراءة حالة الإعداد.');
      setStatus(data);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر قراءة حالة الإعداد.' });
    } finally { setIsLoading(false); }
  };

  useEffect(() => { void loadStatus(); }, []);

  const saveKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!apiKey.trim()) { setMessage({ type: 'error', text: 'اكتب مفتاح Composio أولاً.' }); return; }
    setIsSaving(true); setMessage(null);
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/composio', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر حفظ المفتاح.');
      setApiKey(''); setStatus({ configured: true, updated_at: data.updated_at ?? new Date().toISOString() });
      setMessage({ type: 'success', text: 'تم حفظ مفتاح Composio داخل Vault بنجاح. لن يتم عرضه مرة أخرى.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر حفظ المفتاح.' });
    } finally { setIsSaving(false); }
  };

  return <section dir="rtl" className="mx-auto w-full max-w-2xl px-4 py-6 text-[#F5F5F5]">
    <button type="button" onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-white"><ArrowRight className="h-5 w-5" />العودة</button>
    <div className="mb-6 flex items-start gap-4"><div className="rounded-2xl border border-[#164E63] bg-[#082F49] p-3"><ShieldCheck className="h-7 w-7 text-[#38BDF8]" /></div><div><h1 className="text-2xl font-bold">إعدادات الإدارة</h1><p className="mt-1 text-sm text-[#A1A1AA]">إدارة اتصال Composio بطريقة لا تكشف المفتاح للواجهة أو السجلات.</p></div></div>
    <div className="rounded-2xl border border-[#2A2A2A] bg-[#151515] p-5 shadow-xl">
      <div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><KeyRound className="h-5 w-5 text-[#38BDF8]" /><div><h2 className="font-semibold">Composio Platform API Key</h2><p className="mt-1 text-xs text-[#8B8B8B]">يُستخدم لاحقاً لإنشاء جلسات وأدوات المستخدمين.</p></div></div>{isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#8B8B8B]" /> : status?.configured ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-4 w-4" />مُضاف</span> : <span className="text-xs text-amber-400">غير مُضاف</span>}</div>
      <form onSubmit={saveKey} className="space-y-4"><label className="block text-sm text-[#D4D4D8]">المفتاح <input type="password" dir="ltr" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={status?.configured ? 'أدخل مفتاحاً جديداً للاستبدال' : 'ak_...'} className="mt-2 h-12 w-full rounded-xl border border-[#333] bg-[#0D0D0D] px-4 text-left text-sm text-white outline-none placeholder:text-[#666] focus:border-[#38BDF8]" /></label><p className="text-xs leading-5 text-[#8B8B8B]">لن يتم حفظ المفتاح في المتصفح أو Git. الحفظ يستبدل المفتاح السابق داخل Supabase Vault، ولا تعرض الشاشة القيمة الحالية.</p><button disabled={isSaving} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0EA5E9] font-bold text-white transition hover:bg-[#0284C7] disabled:cursor-not-allowed disabled:opacity-60">{isSaving && <Loader2 className="h-5 w-5 animate-spin" />}حفظ المفتاح بشكل آمن</button></form>
      {message && <div className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${message.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-red-900/60 bg-red-950/30 text-red-300'}`}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{message.text}</div>}
    </div>
  </section>;
};
