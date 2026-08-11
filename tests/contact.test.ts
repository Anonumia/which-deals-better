import { describe, expect, it } from 'vitest';
import { buildBrevoRequest, onRequestPost, validateContact } from '../functions/api/contact';
const good = { name:'Alex Shopper', email:'alex@example.com', message:'Hello there', website:'' };
describe('contact endpoint', () => {
  it('validates a correct submission',()=>expect(validateContact(good).ok).toBe(true));
  it('rejects the honeypot',()=>expect(validateContact({...good,website:'spam'}).ok).toBe(false));
  it('rejects malformed email',()=>expect(validateContact({...good,email:'nope'}).ok).toBe(false));
  it('rejects empty and oversized messages',()=>{expect(validateContact({...good,message:''}).ok).toBe(false);expect(validateContact({...good,message:'x'.repeat(5001)}).ok).toBe(false)});
  it('rejects header injection',()=>expect(validateContact({...good,name:'Alex\r\nBcc:bad@example.com'}).ok).toBe(false));
  it('fails safely when environment is missing',async()=>{const request=new Request('https://example.com/api/contact',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(good)});expect((await onRequestPost({request,env:{}})).status).toBe(503)});
  it('builds an escaped Brevo message without exposing the API key',()=>{const body=buildBrevoRequest({...good,name:'<Alex>'},{BREVO_API_KEY:'secret',CONTACT_RECIPIENT_EMAIL:'to@example.com',CONTACT_SENDER_EMAIL:'from@example.com'},'2026-08-10T00:00:00Z');expect(JSON.stringify(body)).not.toContain('secret');expect(body.htmlContent).toContain('&lt;Alex&gt;');expect(body.replyTo.email).toBe('alex@example.com')});
});
