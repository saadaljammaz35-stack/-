import { z } from 'zod';

/*
 * Schemas shared by the browser (React Hook Form) and the server (server actions / route handlers).
 * Error messages are dictionary keys under `forms.*`, so both languages render the right text.
 */

const trimmed = (min: number, max: number) =>
  z.string().trim().min(min, min <= 1 ? 'required' : 'tooShort').max(max, 'tooLong');

const optionalText = (max: number) =>
  z.string().trim().max(max, 'tooLong').optional().transform((v) => (v ? v : undefined));

export const emailField = z
  .string()
  .trim()
  .min(1, 'required')
  .max(254, 'tooLong')
  .pipe(z.email('invalidEmail'))
  .transform((v) => v.toLowerCase());

const httpsUrl = z
  .string()
  .trim()
  .max(500, 'tooLong')
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(v), 'invalidUrl');

const locale = z.enum(['ar', 'en']);

/** Anti-spam fields present on every public form. */
const antiSpam = {
  website_confirm: z.string().max(0).optional(), // honeypot: must stay empty
  _t: z.string().max(200).optional(), // signed issued-at token
};

export const contactKinds = ['general', 'press', 'guest_suggestion', 'feedback'] as const;

export const contactSchema = z.object({
  kind: z.enum(contactKinds),
  name: trimmed(1, 120),
  email: emailField,
  subject: optionalText(200),
  message: trimmed(10, 5000),
  locale,
  ...antiSpam,
});
export type ContactInput = z.input<typeof contactSchema>;

export const careersSchema = z.object({
  name: trimmed(1, 120),
  email: emailField,
  position: trimmed(2, 120),
  portfolio: httpsUrl,
  message: trimmed(10, 5000),
  locale,
  ...antiSpam,
});
export type CareersInput = z.input<typeof careersSchema>;

export const budgetRanges = ['under_25k', '25k_75k', '75k_200k', 'over_200k', 'undisclosed'] as const;
export const sponsorshipInterests = ['episode_sponsor', 'series_partner', 'branded_content', 'events'] as const;

export const sponsorshipSchema = z.object({
  company: trimmed(1, 160),
  contactName: trimmed(1, 120),
  email: emailField,
  phone: z
    .string()
    .trim()
    .max(24, 'tooLong')
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^[+0-9 ()-]{6,24}$/.test(v), 'invalidPhone'),
  website: httpsUrl,
  budget: z.enum(budgetRanges).optional(),
  interests: z.array(z.enum(sponsorshipInterests)).max(4).default([]),
  message: trimmed(10, 5000),
  locale,
  ...antiSpam,
});
export type SponsorshipInput = z.input<typeof sponsorshipSchema>;

export const newsletterSchema = z.object({
  email: emailField,
  locale,
  source: z.string().max(60).optional(),
  ...antiSpam,
});
export type NewsletterInput = z.input<typeof newsletterSchema>;

const uuid = z.uuid();

export const analyticsEventSchema = z.object({
  type: z.enum(['page_view', 'play_start', 'play_progress', 'play_complete', 'share', 'newsletter_signup', 'outbound_click']),
  path: z.string().max(300).regex(/^\//).optional(),
  locale: locale.optional(),
  episodeId: uuid.optional(),
  articleId: uuid.optional(),
  clipId: uuid.optional(),
  listenerId: uuid.optional(),
  value: z.number().min(0).max(100000).optional(),
  referrer: z.string().max(500).optional(),
});
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;

export const progressSchema = z.object({
  listenerId: uuid,
  episodeId: uuid,
  position: z.number().min(0).max(86400),
  duration: z.number().min(0).max(86400).optional(),
  completed: z.boolean().optional(),
});
export type ProgressInput = z.infer<typeof progressSchema>;

/** Flattens Zod issues to { field: messageKey } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
