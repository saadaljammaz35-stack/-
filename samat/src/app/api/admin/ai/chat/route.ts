import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';
import { runAssistant } from '@/lib/ai/agent';
import { AppError, errorResponse } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';

const Body = z.object({ messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) })).min(1).max(40) });

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const staff = await requireStaff('ai.use');
    if (!env.anthropicApiKey) throw new AppError('ai_not_configured', 503);
    await rateLimit('ai', staff.userId, 30, 600);
    const b = Body.safeParse(await req.json());
    if (!b.success || b.data.messages.at(-1)?.role !== 'user') throw new AppError('invalid_request');
    const started = new Date().toISOString();
    const result = await runAssistant(await userDb(), staff, b.data.messages);
    // confirmation cards for any action the assistant queued during this turn
    const { data: pending } = await adminDb().from('ai_pending_actions').select('id, action, summary_ar, summary_en, status, expires_at')
      .eq('requested_by', staff.userId).eq('status', 'pending').gte('created_at', started).order('created_at');
    return Response.json({ ...result, pending: pending ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
