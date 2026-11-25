import { z } from 'zod';
import { NextResponse } from 'next/server';
import { readBody, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { enforce, LIMITS } from '@/lib/security/rate-limit';
import { scheduleQueue, type Params } from '@/lib/api';
import { createProject, uploadIntent } from '@/lib/media/montage';

export const maxDuration = 120;

const Intent = z.object({ action: z.literal('intent'), name: z.string().min(1).max(255), size: z.number().int().positive(), type: z.string().max(100).default('') });
const Create = z.object({
  action: z.literal('create'),
  key: z.string().min(10).max(1024),
  name: z.string().min(1).max(255),
  mime: z.string().max(100).default('video/mp4'),
  size: z.number().int().positive().optional(),
  transcript_source: z.enum(['whisper', 'upload', 'none']),
  transcript_text: z.string().max(4_000_000).optional(),
  transcript_name: z.string().max(255).optional(),
  preset: z.enum(['light', 'normal', 'tight']).default('normal'),
});

/** Step 1: ask where to upload the video. Step 2: after the upload, start the montage. */
export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'content.write');
  const { id } = await ctx.params;
  const body = z.discriminatedUnion('action', [Intent, Create]).parse(await readBody(req));
  if (body.action === 'intent') {
    await enforce(`upload:${s.userId}`, LIMITS.uploadPerUser.limit, LIMITS.uploadPerUser.windowSec);
    return NextResponse.json(await uploadIntent(s, id, body));
  }
  const projectId = await createProject(s, id, body);
  scheduleQueue();
  return NextResponse.json({ id: projectId, url: `/os/montage/${projectId}` });
});
