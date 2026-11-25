import { NextResponse } from 'next/server';
import { issueFormToken } from '@/lib/security/tokens';

const FORMS = new Set(['contact', 'careers', 'sponsorship', 'newsletter']);

export const dynamic = 'force-dynamic';

/** Issues the signed timing token that public forms submit back (see verifyFormToken). */
export async function GET(request: Request) {
  const form = new URL(request.url).searchParams.get('form') ?? '';
  if (!FORMS.has(form)) return NextResponse.json({ error: 'unknown form' }, { status: 400 });
  return NextResponse.json({ token: issueFormToken(form) }, { headers: { 'Cache-Control': 'no-store' } });
}
