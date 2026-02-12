import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const htmlPath = path.join(process.cwd(), 'public', 'automation-test-sandbox.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'",
      },
    });
  } catch (error) {
    return new NextResponse('Test sandbox not found', { status: 404 });
  }
}
