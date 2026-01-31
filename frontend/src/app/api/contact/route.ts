import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with key from env
// Note: User provided RESENT_API_KEY in the prompt
const resend = new Resend(process.env.RESENT_API_KEY || process.env.RESEND_API_KEY);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, message, websiteId } = body;

        if (!name || !email || !message) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const { data, error } = await resend.emails.send({
            from: 'Seentics Support <support@seentics.com>', // User requested sender address
            to: ['shohagmiah2100@gmail.com'], // Send TO the user (admin)
            // In production, this should be configurable or sent to a support inbox.
            // Assuming 'shohagmiah2100@gmail.com' is the user's email based on Calendly link.
            replyTo: email,
            subject: `New Support Message from ${name}`,
            text: `
Name: ${name}
Email: ${email}
Website ID: ${websiteId}

Message:
${message}
      `,
        });

        if (error) {
            console.error('Resend error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('Contact API error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
