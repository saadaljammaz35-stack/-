import { NextResponse } from 'next/server';
import { issueFormToken } from '@/lib/security/tokens';
import { hasAppSecret } from '@/lib/server-env';

const FORMS = new Set(['contact', 'careers', 'sponsorship', 'newsletter']);

export const dynamic = 'force-dynamic';

/** Issues the signed timing token that public forms submit back (see verifyFormToken). */
export async function GET(request: Request) {
  const form = new URL(request.url).searchParams.get('form') ?? '';
  if (!FORMS.has(form)) return NextResponse.json({ error: 'unknown form' }, { status: 400 });
  if (!hasAppSecret()) return NextResponse.json({ error: 'not configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ token: issueFormToken(form) }, { headers: { 'Cache-Control': 'no-store' } });
}
