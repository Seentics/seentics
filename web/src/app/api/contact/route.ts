import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const body = await req.json();
    const { name, email, message, subject, company, websiteId } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required.' },
        { status: 400 }
      );
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
      to: process.env.CONTACT_EMAIL || 'shohagmiah2100@gmail.com',
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

    return NextResponse.json({ success: true, message: 'Message sent successfully' });
  } catch (error: any) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }
}
