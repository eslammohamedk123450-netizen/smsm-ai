export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  senderName: string;
  senderEmail: string;
  companyHint: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  labelIds: string[];
}

export interface GmailMessageFull extends GmailMessageSummary {
  bodyText: string;
}

export interface LiveConnectionReport {
  gmail: {
    connected: boolean;
    source: 'gmail_oauth' | 'composio' | 'none';
    email: string | null;
    error?: string;
  };
  composio: {
    configured: boolean;
    toolkits: Record<string, { connected: boolean; status: string | null }>;
  };
}

const GENERIC_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
]);

function extractEmailAndName(rawFrom: string): {
  senderName: string;
  senderEmail: string;
  companyHint: string;
} {
  const trimmed = rawFrom.trim();
  const angleMatch = trimmed.match(/^(?:"?([^"<]+)"?\s*)?<([^>]+)>$/);
  const senderName = (angleMatch?.[1] ?? '').trim() || trimmed.split('@')[0] || trimmed;
  const senderEmail = (angleMatch?.[2] ?? (trimmed.includes('@') ? trimmed : '')).trim().toLowerCase();

  let companyHint = 'حساب شخصي';
  const domain = senderEmail.split('@')[1] ?? '';
  if (domain && !GENERIC_MAIL_DOMAINS.has(domain)) {
    const parts = domain.split('.');
    const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (core && !['mail', 'email', 'notify', 'noreply', 'support'].includes(core)) {
      companyHint = core.charAt(0).toUpperCase() + core.slice(1);
    } else if (parts.length >= 3) {
      const sub = parts[0];
      companyHint = sub.charAt(0).toUpperCase() + sub.slice(1);
    } else {
      companyHint = domain;
    }
  }
  return { senderName, senderEmail, companyHint };
}

function getHeader(
  headers: Array<{ name?: string; value?: string }> | undefined,
  target: string
): string {
  if (!Array.isArray(headers)) return '';
  const found = headers.find((h) => h.name?.toLowerCase() === target.toLowerCase());
  return found?.value ?? '';
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBodyFromPayload(payload: any): string {
  if (!payload) return '';
  const mimeType = String(payload.mimeType || '').toLowerCase();
  if (payload.body?.data && mimeType === 'text/plain') {
    return decodeBase64Url(payload.body.data).trim();
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (String(part.mimeType || '').toLowerCase() === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data).trim();
      }
    }
    for (const part of payload.parts) {
      const nested = extractBodyFromPayload(part);
      if (nested) return nested;
    }
  }
  if (payload.body?.data && mimeType === 'text/html') {
    return stripHtml(decodeBase64Url(payload.body.data));
  }
  return '';
}

export async function checkLiveConnections(
  gmailToken: string | null,
  composioApiKey?: string
): Promise<LiveConnectionReport> {
  const report: LiveConnectionReport = {
    gmail: {
      connected: false,
      source: 'none',
      email: null,
    },
    composio: {
      configured: Boolean(composioApiKey),
      toolkits: {
        gmail: { connected: false, status: null },
        googledrive: { connected: false, status: null },
        github: { connected: false, status: null },
      },
    },
  };

  if (gmailToken) {
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${gmailToken}` },
      });
      if (res.ok) {
        const profile = (await res.json()) as { emailAddress?: string };
        report.gmail = {
          connected: true,
          source: 'gmail_oauth',
          email: profile.emailAddress ?? null,
        };
      } else {
        report.gmail.error = `HTTP_${res.status}`;
      }
    } catch (err) {
      report.gmail.error = err instanceof Error ? err.message : 'network_error';
    }
  }

  if (composioApiKey) {
    try {
      const res = await fetch('https://backend.composio.dev/api/v3/connected_accounts?limit=20', {
        headers: { 'x-api-key': composioApiKey },
      });
      if (res.ok) {
        const data = (await res.json()) as { items?: Array<Record<string, any>> };
        for (const item of data.items ?? []) {
          const slug = String(item.toolkit?.slug ?? item.appName ?? '').toLowerCase();
          const isActive = item.status === 'ACTIVE' && item.is_disabled !== true;
          if (slug.includes('gmail')) {
            report.composio.toolkits.gmail = { connected: isActive, status: String(item.status ?? null) };
            if (isActive && !report.gmail.connected) {
              report.gmail = {
                connected: true,
                source: 'composio',
                email: item.member?.email ?? null,
              };
            }
          } else if (slug.includes('drive')) {
            report.composio.toolkits.googledrive = { connected: isActive, status: String(item.status ?? null) };
          } else if (slug.includes('github')) {
            report.composio.toolkits.github = { connected: isActive, status: String(item.status ?? null) };
          }
        }
      }
    } catch {
      // Keep non-fatal Composio check failure isolated
    }
  }

  return report;
}

export async function listGmailMessages(
  gmailToken: string,
  options: { maxResults?: number; query?: string; labelIds?: string[] } = {}
): Promise<GmailMessageSummary[]> {
  const maxResults = Math.max(1, Math.min(20, options.maxResults ?? 10));
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (options.query?.trim()) params.set('q', options.query.trim());
  if (options.labelIds?.length) {
    for (const label of options.labelIds) params.append('labelIds', label);
  }

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${gmailToken}` } }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Gmail API list error (${listRes.status}): ${errText.slice(0, 200)}`);
  }

  const listData = (await listRes.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
  };
  const refs = listData.messages ?? [];
  if (refs.length === 0) return [];

  const details = await Promise.all(
    refs.map(async (ref) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${gmailToken}` } }
      );
      if (!msgRes.ok) return null;
      const msg = (await msgRes.json()) as any;
      const headers = msg.payload?.headers;
      const from = getHeader(headers, 'From');
      const { senderName, senderEmail, companyHint } = extractEmailAndName(from);
      return {
        id: String(msg.id),
        threadId: String(msg.threadId || ''),
        from,
        senderName,
        senderEmail,
        companyHint,
        to: getHeader(headers, 'To'),
        subject: getHeader(headers, 'Subject') || '(بدون عنوان)',
        date: getHeader(headers, 'Date'),
        snippet: String(msg.snippet || ''),
        labelIds: Array.isArray(msg.labelIds) ? msg.labelIds : [],
      } satisfies GmailMessageSummary;
    })
  );

  return details.filter((item): item is GmailMessageSummary => item !== null);
}

export async function getGmailMessageDetail(
  gmailToken: string,
  messageId: string
): Promise<GmailMessageFull> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
    { headers: { Authorization: `Bearer ${gmailToken}` } }
  );
  if (!res.ok) {
    throw new Error(`تعذر قراءة تفاصيل الرسالة (${res.status}).`);
  }
  const msg = (await res.json()) as any;
  const headers = msg.payload?.headers;
  const from = getHeader(headers, 'From');
  const { senderName, senderEmail, companyHint } = extractEmailAndName(from);
  const bodyText = extractBodyFromPayload(msg.payload) || String(msg.snippet || '');
  return {
    id: String(msg.id),
    threadId: String(msg.threadId || ''),
    from,
    senderName,
    senderEmail,
    companyHint,
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject') || '(بدون عنوان)',
    date: getHeader(headers, 'Date'),
    snippet: String(msg.snippet || ''),
    labelIds: Array.isArray(msg.labelIds) ? msg.labelIds : [],
    bodyText: bodyText.slice(0, 8000),
  };
}

export async function sendGmailMessage(
  gmailToken: string,
  params: { to: string; subject: string; body: string; threadId?: string }
): Promise<{ id: string; threadId: string }> {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(params.subject, 'utf8').toString('base64')}?=`;
  const mime = [
    `To: ${params.to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(params.body, 'utf8').toString('base64'),
  ].join('\r\n');

  const raw = Buffer.from(mime, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gmailToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw,
      ...(params.threadId ? { threadId: params.threadId } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`فشل إرسال البريد (${res.status}): ${errText.slice(0, 200)}`);
  }
  const sent = (await res.json()) as { id: string; threadId: string };
  return sent;
}

export async function trashGmailMessage(
  gmailToken: string,
  messageId: string
): Promise<{ id: string; trashed: boolean }> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/trash`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmailToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(`تعذر نقل الرسالة إلى المهملات (${res.status}).`);
  }
  return { id: messageId, trashed: true };
}

export async function modifyGmailLabels(
  gmailToken: string,
  messageId: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = []
): Promise<{ id: string; labelIds: string[] }> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gmailToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ addLabelIds, removeLabelIds }),
    }
  );
  if (!res.ok) {
    throw new Error(`تعذر تعديل تصنيفات الرسالة (${res.status}).`);
  }
  const data = (await res.json()) as { id: string; labelIds?: string[] };
  return { id: data.id, labelIds: data.labelIds ?? [] };
}
