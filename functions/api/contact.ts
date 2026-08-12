interface Env { BREVO_API_KEY?: string; CONTACT_TO_EMAIL?: string; CONTACT_FROM_EMAIL?: string; }
interface ContactPayload { name?: unknown; email?: unknown; subject?: unknown; message?: unknown; website?: unknown; }
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
  if (name.length > 80) return { ok: false as const, status: 400, message: 'Enter a name of 80 characters or fewer.' };
  if (!validEmail(email)) return { ok: false as const, status: 400, message: 'Enter a valid email address.' };
  if (!message || message.length > 5000) return { ok: false as const, status: 400, message: 'Enter a message of 5,000 characters or fewer.' };
  if (/[\r\n]/.test(name)) return { ok: false as const, status: 400, message: 'Enter a valid name.' };
  return { ok: true as const, value: { name, email, message } };
}

export const formatSubmittedAt = (date: Date) => {
  const timeZone = 'America/New_York';
  const formattedDate = new Intl.DateTimeFormat('en-US', { timeZone, month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  const formattedTime = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date);
  return `${formattedDate} • ${formattedTime}`;
};

export function buildBrevoRequest(data: { name: string; email: string; subject?: string; message: string }, env: Required<Env>, submitted: string) {
  const displayName = data.name || 'Not provided';
  const displaySubject = data.subject || '(No subject provided)';
  const replyName = data.name || data.email;
  const divider = '--------------------------------------------------';
  const emailFields = [
    ['Name', displayName],
    ['Email', data.email],
    ['Subject', displaySubject],
    ['Submitted', submitted],
  ];
  const htmlFields = emailFields.map(([label, value]) => `
    <tr>
      <td style="padding:8px 16px 8px 0;color:#64748b;font-size:13px;font-weight:700;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#1e293b;font-size:14px;line-height:1.5;">${escapeHtml(value)}</td>
    </tr>`).join('');
  const htmlContent = `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#1e293b;">
  <div style="padding:32px 16px;">
    <div style="max-width:640px;margin:0 auto;overflow:hidden;border:1px solid #dbe5df;border-radius:16px;background:#ffffff;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      <div style="padding:24px 28px;background:#173f35;color:#ffffff;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c8dfb4;">Which Deal's Better?</div>
        <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;">New contact form submission</h1>
      </div>
      <div style="padding:24px 28px;">
        <table role="presentation" style="width:100%;border-collapse:collapse;">${htmlFields}
        </table>
        <div style="height:1px;margin:20px 0;background:#e2e8f0;"></div>
        <div style="margin-bottom:8px;color:#64748b;font-size:13px;font-weight:700;">Message</div>
        <div style="white-space:pre-wrap;color:#1e293b;font-size:15px;line-height:1.65;">${escapeHtml(data.message)}</div>
      </div>
      <div style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5;">Reply to this email to respond directly to ${escapeHtml(replyName)}.</div>
    </div>
  </div>
</body></html>`;
  return {
    sender: { name: "Which Deal's Better?", email: env.CONTACT_FROM_EMAIL },
    to: [{ email: env.CONTACT_TO_EMAIL }],
    replyTo: { email: data.email, name: replyName },
    subject: `Which Deal's Better? contact: ${data.subject || 'General inquiry'}`,
    htmlContent,
    textContent: `${divider}\nNew Which Deal's Better? Contact Form Submission\n${divider}\n\nWebsite:\nWhich Deal's Better?\n\nName:\n${displayName}\n\nEmail:\n${data.email}\n\nSubject:\n${displaySubject}\n\nMessage:\n${data.message}\n\nSubmitted:\n${submitted}\n\n${divider}\n\nReply to this email to respond directly to ${replyName}.`,
    tags: ['which-deals-better-contact'],
  };
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return json(415, 'Please submit the form using the website.');
  let payload: ContactPayload;
  try { payload = await request.json() as ContactPayload; } catch { return json(400, 'The form data could not be read.'); }
  const validated = validateContact(payload);
  if (!validated.ok) return json(validated.status, validated.message);
  if (!env.BREVO_API_KEY || !env.CONTACT_TO_EMAIL || !env.CONTACT_FROM_EMAIL) return json(503, 'Contact is temporarily unavailable. Please try again later.');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now(); const recent = (rateLimit.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return json(429, 'Too many messages were submitted. Please wait and try again.');
  recent.push(now); rateLimit.set(ip, recent);
  const duplicateKey = `${ip}:${fingerprint(`${validated.value.email}\n${validated.value.message}`)}`;
  if (now - (duplicates.get(duplicateKey) || 0) < DUPLICATE_MS) return json(409, 'This message was already submitted.');
  duplicates.set(duplicateKey, now);
  const body = buildBrevoRequest(validated.value, env as Required<Env>, formatSubmittedAt(new Date(now)));
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { accept: 'application/json', 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) { duplicates.delete(duplicateKey); return json(502, 'Your message could not be sent right now. Please try again later.'); }
    return json(200, 'Thanks—your message was sent.');
  } catch { duplicates.delete(duplicateKey); return json(502, 'Your message could not be sent right now. Please try again later.'); }
}

export const onRequest = () => json(405, 'Method not allowed.');
