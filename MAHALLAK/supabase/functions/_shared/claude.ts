import { Anthropic, betaZodOutputFormat, z } from './deps.ts';
import { HttpError } from './http.ts';

/**
 * Claude access for MAHALLAK. The key lives only in Edge Function secrets.
 * Model is configurable (MAHALLAK_AI_MODEL); the default follows the current
 * recommended model. Server-side fallbacks keep requests working if a model
 * declines; every output is schema-validated before it reaches the app.
 */
export const DEFAULT_MODEL = 'claude-opus-5-5';

let client: Anthropic | null = null;
export function claude(): Anthropic {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new HttpError(501, 'ai_not_configured');
  client ??= new Anthropic({ apiKey, maxRetries: 2, timeout: 45_000 });
  return client;
}

export const model = () => Deno.env.get('MAHALLAK_AI_MODEL') || DEFAULT_MODEL;

export const CATEGORIES = ['clothing', 'shoes', 'electronics', 'tools', 'bags', 'keys', 'toys', 'books', 'accessories', 'documents', 'household', 'other'] as const;
export const COLORS = ['white', 'black', 'gray', 'silver', 'gold', 'beige', 'brown', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple'] as const;

export const ItemSchema = z.object({
  name_ar: z.string().describe('Everyday Saudi Arabic name, e.g. «سماعة AirPods», «شماغ أحمر», «شاحن ايفون»'),
  name_en: z.string(),
  category: z.enum(CATEGORIES),
  color: z.enum(COLORS).nullable(),
  keywords: z.array(z.string()).describe('2-6 other names, brands or spellings a Saudi user might say'),
  confidence: z.number().describe('0..1, how sure you are about what the object is'),
});

export const DetectionSchema = z.object({
  items: z.array(
    ItemSchema.extend({
      box: z
        .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
        .nullable()
        .describe('normalized 0..1 bounding box, top-left origin'),
    }),
  ),
});

export const QuerySchema = z.object({
  intent: z.enum(['find_item', 'list_location', 'item_history', 'recent', 'unknown']),
  item_words: z.array(z.string()).describe('words naming the item(s), as said plus a standard Arabic equivalent'),
  place_words: z.array(z.string()).describe('words naming a room, furniture or container'),
  color: z.enum(COLORS).nullable(),
  time: z.enum(['today', 'yesterday', 'day_before', 'this_week', 'last_week', 'recent']).nullable(),
});

type ImageMedia = 'image/jpeg' | 'image/png';

async function run<T extends z.ZodType>(schema: T, system: string, content: Anthropic.Beta.Messages.BetaContentBlockParam[]) {
  const res = await claude().beta.messages.parse({
    model: model(),
    max_tokens: 4096,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: 'user', content }],
  });
  if (res.stop_reason === 'refusal') throw new HttpError(422, 'rejected');
  if (!res.parsed_output) throw new HttpError(502, 'ai_invalid_output');
  return { output: res.parsed_output as z.infer<T>, usage: res.usage };
}

const RECOGNIZE_SYSTEM = `You identify ONE household item in a photo for a private home-inventory app used in Saudi Arabia.
- name_ar: the most specific everyday name a Saudi person would say (Saudi/Gulf colloquial is welcome: شماغ، ثوب، بوك، جزمة، كوتش، شاحن). Include a brand only if it is clearly visible.
- name_en: the same in plain English.
- category and color: choose from the allowed values; color null if unclear.
- keywords: alternative names, plural forms, English/Arabic spellings the user might say when asking for it later.
- confidence: low (< 0.3) when there is no single clear item.
Describe only the object. Never describe or infer anything about people, faces, documents' contents or the home's address.`;

const DETECT_SYSTEM = `You list the distinct physical items visible in a photo of a drawer, shelf, box or table, for a private home-inventory app used in Saudi Arabia.
- At most 20 items. Do not list the container, furniture or background surfaces.
- One entry per distinct object; group identical small things (e.g. "أقلام") into one entry.
- Lower confidence for partially hidden, blurry or ambiguous objects; the user confirms every item before saving.
- Names follow the same rules as everyday Saudi Arabic usage; never read out the contents of documents or cards.`;

const QUERY_SYSTEM = `You convert a short question in Saudi Arabic (any regional dialect: Najdi, Hijazi, Eastern, Southern, Northern) or English, about where the user put something, into a structured query for searching their own item list.
Do NOT answer the question and do NOT invent items. Only restructure the words.
Examples: «وين حطيت سماعتي؟» -> find_item, item_words [سماعة]; «وش عندي في درج المكتب» -> list_location, place_words [درج, مكتب]; «وين كان الجواز قبل» -> item_history.
If the text is not about finding belongings, use intent "unknown".`;

export function recognize(image: { data: string; mediaType: ImageMedia }, locale: string) {
  return run(ItemSchema, RECOGNIZE_SYSTEM, [
    { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
    { type: 'text', text: `UI language: ${locale === 'en' ? 'English' : 'Arabic'}. Identify the item.` },
  ]);
}

export function detect(image: { data: string; mediaType: ImageMedia }, locale: string) {
  return run(DetectionSchema, DETECT_SYSTEM, [
    { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
    { type: 'text', text: `UI language: ${locale === 'en' ? 'English' : 'Arabic'}. List the items.` },
  ]);
}

export function understand(text: string) {
  return run(QuerySchema, QUERY_SYSTEM, [{ type: 'text', text: `<question>${text.replace(/[<>]/g, '')}</question>` }]);
}

export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
