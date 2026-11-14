import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import {
  createModelConfig,
  getAdminCatalogState,
  updateModelConfig,
  updateRouterPolicy,
} from './server/modelStore.ts';
import { checkLiveConnections } from './server/gmailBridge.ts';
import { runRouterStream } from './server/agentEngine.ts';
import type { ExecutionMode, PlanTier } from './src/types.ts';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '10mb' }));

function getSupabaseFromRequest(req: express.Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const authorization = req.header('authorization');
  if (!supabaseUrl || !supabaseAnonKey || !authorization?.startsWith('Bearer ')) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Live integrations connection check (Gmail OAuth Bearer + Composio)
app.get('/api/integrations/status', async (req, res) => {
  const gmailToken = req.header('x-gmail-token')?.trim() || null;
  const composioKey = process.env.COMPOSIO_API_KEY?.trim() || undefined;
  const report = await checkLiveConnections(gmailToken, composioKey);
  return res.json(report);
});

// Admin model & capability matrix endpoints
app.get('/api/admin/models', (_req, res) => {
  return res.json(getAdminCatalogState());
});

app.put('/api/admin/models/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'معرّف النموذج غير صالح.' });
  }
  const updated = updateModelConfig(id, req.body ?? {});
  if (!updated) {
    return res.status(404).json({ error: 'النموذج غير موجود.' });
  }
  return res.json({ model: updated });
});

app.post('/api/admin/models', (req, res) => {
  const body = req.body ?? {};
  if (!body.name || !body.modelIdentifier) {
    return res.status(400).json({ error: 'اسم النموذج والمعرف التقني مطلوبان.' });
  }
  const created = createModelConfig({
    name: String(body.name),
    provider: String(body.provider || 'google-genai'),
    modelIdentifier: String(body.modelIdentifier),
    enabled: body.enabled !== false,
    priority: Number(body.priority || 75),
    routingGroup: body.routingGroup || 'free_race',
    allowedModes: Array.isArray(body.allowedModes) ? body.allowedModes : ['chat', 'agent'],
    taskRoles: Array.isArray(body.taskRoles) ? body.taskRoles : ['general'],
    allowedTiers: Array.isArray(body.allowedTiers) ? body.allowedTiers : ['Free', 'Business Pro', 'Enterprise'],
    capabilities: body.capabilities || {
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
    },
    responseTimeoutMs: Number(body.responseTimeoutMs || 20000),
    description: typeof body.description === 'string' ? body.description : undefined,
  });
  return res.status(201).json({ model: created });
});

app.put('/api/admin/policy', (req, res) => {
  const policy = updateRouterPolicy(req.body ?? {});
  return res.json({ policy });
});

// Supabase Composio Vault status / update (preserved for Supabase-linked deployments)
app.get('/api/admin/composio', async (req, res) => {
  const supabase = getSupabaseFromRequest(req);
  if (!supabase) {
    return res.json({
      configured: Boolean(process.env.COMPOSIO_API_KEY),
      updated_at: null,
      mode: 'local_preview',
    });
  }
  const { data, error } = await supabase.rpc('suly_admin_composio_status');
  if (error) {
    return res
      .status(error.code === '42501' ? 403 : 500)
      .json({ error: 'لا يمكن قراءة حالة إعداد Composio لهذه الجلسة.' });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return res.json({ configured: row?.configured === true, updated_at: row?.updated_at ?? null });
});

app.put('/api/admin/composio', async (req, res) => {
  const supabase = getSupabaseFromRequest(req);
  if (!supabase) {
    return res.status(401).json({ error: 'جلسة المدير في Supabase غير متصلة في هذه المعاينة.' });
  }
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  if (!apiKey || apiKey.length > 16384) {
    return res.status(400).json({ error: 'مفتاح Composio غير صالح.' });
  }
  const { error } = await supabase.rpc('suly_admin_set_composio_api_key', { p_api_key: apiKey });
  if (error) {
    return res
      .status(error.code === '42501' ? 403 : 400)
      .json({ error: 'تعذر حفظ مفتاح Composio داخل Vault.' });
  }
  return res.json({ ok: true, updated_at: new Date().toISOString() });
});

// Streaming SSE AI Router (supports Chat Mode & Agent Mode)
app.post('/api/ai-router', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  const body = req.body ?? {};
  const executionMode: ExecutionMode = body.execution_mode === 'chat' ? 'chat' : 'agent';
  const planTier: PlanTier =
    body.plan_tier === 'Business Pro' || body.plan_tier === 'Enterprise'
      ? body.plan_tier
      : 'Free';
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const gmailToken = req.header('x-gmail-token')?.trim() || null;
  const composioApiKey = process.env.COMPOSIO_API_KEY?.trim() || undefined;

  try {
    await runRouterStream(
      {
        messages,
        executionMode,
        planTier,
        gmailToken,
        composioApiKey,
        confirmAction: body.confirm_action,
      },
      (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع في معالجة الطلب.';
    res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
  } finally {
    res.end();
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Suly AI App running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
