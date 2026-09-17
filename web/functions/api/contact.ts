// Cloudflare Pages Function — replaces src/app/api/contact/route.ts.
// Static export's route handlers only support GET (Next's own docs list
// this under "Unsupported Features" for output: 'export'), and this needs
// POST, so the logic moved here wholesale.
//
// The in-memory rate limiter is gone too — a module-level Map doesn't work
// across Workers' many short-lived, per-edge-location isolates the way it
// did in one long-running Node process. Replaced with a KV-backed counter
// (see functions/lib/rate-limit.ts for why it's KV and not Cloudflare's
// actual Rate Limiting binding) — 60s at a tighter limit is the closest fit
// to the original's 15-minute window, not an exact match.

import { Resend } from 'resend';
import { checkRateLimit } from '../lib/rate-limit';

interface Env {
  RESEND_API_KEY?: string;
  CONTACT_EMAIL?: string;
  RATE_LIMIT_KV: { get: (key: string) => Promise<string | null>; put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void> };
}

interface RequestContext {
  request: Request;
  env: Env;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestPost = async (context: RequestContext): Promise<Response> => {
  const { request, env } = context;

  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const allowed = await checkRateLimit(env.RATE_LIMIT_KV, `contact:${ip}`, 5, 60);
  if (!allowed) {
    return jsonResponse({ error: 'Too many requests. Please try again later.' }, 429);
  }

  const resend = new Resend(env.RESEND_API_KEY);
  try {
    const body = await request.json();
    const { name, email, message, subject, company, websiteId } = body;

    if (!name || !email || !message) {
      return jsonResponse({ error: 'Name, email, and message are required.' }, 400);
    }

    const safeName = escapeHtml(String(name));
    const safeEmail = escapeHtml(String(email));
    const safeMessage = escapeHtml(String(message));
    const safeSubject = subject ? escapeHtml(String(subject)) : null;
    const safeCompany = company ? escapeHtml(String(company)) : null;
    const safeWebsiteId = websiteId ? escapeHtml(String(websiteId)) : null;

    const subjectLine = safeSubject || `New message from ${safeName}`;
    const companyLine = safeCompany ? `\nCompany: ${safeCompany}` : '';
    const websiteLine = safeWebsiteId ? `\nWebsite ID: ${safeWebsiteId}` : '';

    await resend.emails.send({
      from: 'Seentics Contact <onboarding@resend.dev>',
      to: env.CONTACT_EMAIL || 'shohagmiah2100@gmail.com',
      replyTo: email,
      subject: subjectLine,
      text: `Name: ${name}\nEmail: ${email}${companyLine}${websiteLine}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #555; width: 120px;">Name</td>
              <td style="padding: 8px 12px;">${safeName}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 8px 12px; font-weight: 600; color: #555;">Email</td>
              <td style="padding: 8px 12px;"><a href="mailto:${safeEmail}">${safeEmail}</a></td>
            </tr>
            ${safeCompany ? `<tr><td style="padding: 8px 12px; font-weight: 600; color: #555;">Company</td><td style="padding: 8px 12px;">${safeCompany}</td></tr>` : ''}
            ${safeWebsiteId ? `<tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: 600; color: #555;">Website ID</td><td style="padding: 8px 12px;"><code>${safeWebsiteId}</code></td></tr>` : ''}
          </table>
          <div style="background: #f9fafb; border-left: 3px solid #2563eb; padding: 16px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0; color: #555; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Message</p>
            <p style="margin: 0; color: #1a1a1a; white-space: pre-wrap;">${safeMessage}</p>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            Sent from Seentics contact form &middot; Reply directly to respond to ${safeName}
          </p>
        </div>
      `,
    });

    return jsonResponse({ success: true, message: 'Message sent successfully' }, 200);
  } catch (error) {
    console.error('Contact form error:', error);
    return jsonResponse({ error: 'Failed to send message. Please try again later.' }, 500);
  }
};
