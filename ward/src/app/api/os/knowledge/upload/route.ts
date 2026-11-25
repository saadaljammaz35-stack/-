import { z } from 'zod';
import { withOrg } from '@/lib/db';
import { badRequest, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { enforce, LIMITS } from '@/lib/security/rate-limit';
import { createDocument, KNOWLEDGE_CATEGORIES } from '@/lib/knowledge';
import { extractText } from '@/lib/knowledge/extract';
import { storeFile } from '@/lib/services/admin';
import { readUpload } from '@/lib/api';

/** PDF, DOCX, TXT and images → stored privately, text extracted and indexed for retrieval. */
export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'content.write');
  await enforce(`upload:${s.userId}`, LIMITS.uploadPerUser.limit, LIMITS.uploadPerUser.windowSec);
  const up = await readUpload(req);
  const meta = z.object({ category: z.enum(KNOWLEDGE_CATEGORIES).default('files'), title: z.string().trim().max(300).optional(), description: z.string().trim().max(20_000).optional() }).parse(up.fields);
  let text = '';
  try {
    text = await extractText(up.kind, up.data);
  } catch {
    throw badRequest('extraction_failed', 'Could not read text from this file.');
  }
  if (up.kind === 'image' && !meta.description) throw badRequest('image_needs_description', 'Describe the image: no OCR is performed.');
  const fileId = await storeFile(s, { name: up.name, mime: up.mime, data: up.data, purpose: 'knowledge' });
  const content = [meta.description, text].filter(Boolean).join('\n\n');
  const id = await withOrg(s, (q) =>
    createDocument(q, s, { title: meta.title || up.name, category: meta.category, content: content || '(لا يوجد نص قابل للاستخراج)', source: 'upload', fileId, verified: false }),
  );
  return respond(req, { id, extracted_chars: text.length }, { redirect: `/os/knowledge/${id}` });
});
