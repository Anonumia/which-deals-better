interface Env { BREVO_API_KEY?: string; CONTACT_RECIPIENT_EMAIL?: string; CONTACT_SENDER_EMAIL?: string; }
interface ContactPayload { name?: unknown; email?: unknown; message?: unknown; website?: unknown; }
interface PagesContext { request: Request; env: Env; }

const rateLimit = new Map<string, number[]>();
const duplicates = new Map<string, number>();
const WINDOW_MS = 10 * 60 * 1000;
const DUPLICATE_MS = 2 * 60 * 1000;
const MAX_REQUESTS = 5;

const json = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
const validEmail = (value: string) => value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && !/[\r\n]/.test(value);
const fingerprint = (value: string) => { let hash = 2166136261; for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619); return (hash >>> 0).toString(36); };

export function validateContact(input: ContactPayload) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  const website = typeof input.website === 'string' ? input.website.trim() : '';
  if (website) return { ok: false as const, status: 400, message: 'Unable to submit this form.' };
  if (!name || name.length > 80) return { ok: false as const, status: 400, message: 'Enter a name of 80 characters or fewer.' };
  if (!validEmail(email)) return { ok: false as const, status: 400, message: 'Enter a valid email address.' };
  if (!message || message.length > 5000) return { ok: false as const, status: 400, message: 'Enter a message of 5,000 characters or fewer.' };
  if (/[\r\n]/.test(name)) return { ok: false as const, status: 400, message: 'Enter a valid name.' };
  return { ok: true as const, value: { name, email, message } };
}

export function buildBrevoRequest(data: { name: string; email: string; message: string }, env: Required<Env>, timestamp: string) {
  return {
    sender: { name: "Which Deal's Better?", email: env.CONTACT_SENDER_EMAIL },
    to: [{ email: env.CONTACT_RECIPIENT_EMAIL }],
    replyTo: { name: data.name, email: data.email },
    subject: `Website message from ${data.name}`,
    htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#18392f"><h1 style="font-size:22px">New message for Which Deal's Better?</h1><p><strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.email)}&gt;</p><p><strong>Submitted:</strong> ${escapeHtml(timestamp)}</p><hr><p style="white-space:pre-wrap">${escapeHtml(data.message)}</p></div>`,
  };
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return json(415, 'Please submit the form using the website.');
  let payload: ContactPayload;
  try { payload = await request.json() as ContactPayload; } catch { return json(400, 'The form data could not be read.'); }
  const validated = validateContact(payload);
  if (!validated.ok) return json(validated.status, validated.message);
  if (!env.BREVO_API_KEY || !env.CONTACT_RECIPIENT_EMAIL || !env.CONTACT_SENDER_EMAIL) return json(503, 'Contact is temporarily unavailable. Please try again later.');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now(); const recent = (rateLimit.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return json(429, 'Too many messages were submitted. Please wait and try again.');
  recent.push(now); rateLimit.set(ip, recent);
  const duplicateKey = `${ip}:${fingerprint(`${validated.value.email}\n${validated.value.message}`)}`;
  if (now - (duplicates.get(duplicateKey) || 0) < DUPLICATE_MS) return json(409, 'This message was already submitted.');
  duplicates.set(duplicateKey, now);
  const body = buildBrevoRequest(validated.value, env as Required<Env>, new Date(now).toISOString());
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { accept: 'application/json', 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) { duplicates.delete(duplicateKey); return json(502, 'Your message could not be sent right now. Please try again later.'); }
    return json(200, 'Thanks—your message was sent.');
  } catch { duplicates.delete(duplicateKey); return json(502, 'Your message could not be sent right now. Please try again later.'); }
}

export const onRequest = () => json(405, 'Method not allowed.');
