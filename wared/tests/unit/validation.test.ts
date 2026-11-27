import { describe, expect, it } from 'vitest';
import { articleSchema, clipSchema, episodeSchema, isoToRiyadhLocal, riyadhToIso, settingsSchema } from '@/lib/validation/admin';
import { analyticsEventSchema, contactSchema, newsletterSchema, sponsorshipSchema } from '@/lib/validation/public';

describe('public form schemas', () => {
  const contact = { kind: 'general', name: 'سارة', email: ' Sara@Example.com ', message: 'رسالة كافية الطول', locale: 'ar' };
  it('normalises valid input', () => {
    const parsed = contactSchema.parse(contact);
    expect(parsed.email).toBe('sara@example.com');
    expect(parsed.subject).toBeUndefined();
  });
  it('returns dictionary keys as messages', () => {
    const result = contactSchema.safeParse({ ...contact, email: 'nope', message: 'قصير' });
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}:${i.message}`);
    expect(messages).toContain('email:invalidEmail');
    expect(messages).toContain('message:tooShort');
  });
  it('rejects a filled honeypot', () => {
    expect(contactSchema.safeParse({ ...contact, website_confirm: 'http://spam' }).success).toBe(false);
  });
  it('validates sponsorship fields', () => {
    const base = { company: 'شركة', contactName: 'خالد', email: 'k@example.com', message: 'نرغب في رعاية موسم كامل', locale: 'ar' };
    expect(sponsorshipSchema.safeParse({ ...base, interests: ['episode_sponsor'], budget: '25k_75k' }).success).toBe(true);
    expect(sponsorshipSchema.safeParse({ ...base, website: 'javascript:alert(1)' }).success).toBe(false);
    expect(sponsorshipSchema.safeParse({ ...base, interests: ['hacking'] }).success).toBe(false);
    expect(sponsorshipSchema.safeParse({ ...base, phone: '+966 50 000 0000' }).success).toBe(true);
  });
  it('validates newsletter and analytics payloads', () => {
    expect(newsletterSchema.safeParse({ email: 'a@b.co', locale: 'en' }).success).toBe(true);
    expect(newsletterSchema.safeParse({ email: 'a@b.co', locale: 'fr' }).success).toBe(false);
    expect(analyticsEventSchema.safeParse({ type: 'page_view', path: '/ar' }).success).toBe(true);
    expect(analyticsEventSchema.safeParse({ type: 'drop_table', path: '/ar' }).success).toBe(false);
    expect(analyticsEventSchema.safeParse({ type: 'play_start', episodeId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('admin schemas', () => {
  const episode = {
    podcast_id: '6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f',
    slug: 'Ep-01',
    number: '3',
    season: '',
    episode_type: 'full',
    title: 'الحلقة',
    title_en: '',
    summary: '',
    audio_url: '',
    youtube_video_id: '',
    is_featured: false,
    explicit: false,
    status: 'draft',
    published_at: '',
    guest_ids: [],
  };
  it('turns empty strings into nulls and coerces numbers', () => {
    const parsed = episodeSchema.parse(episode);
    expect(parsed.slug).toBe('ep-01');
    expect(parsed.number).toBe(3);
    expect(parsed.season).toBeNull();
    expect(parsed.title_en).toBeNull();
    expect(parsed.audio_url).toBeNull();
    expect(parsed.published_at).toBeNull();
  });
  it('rejects bad slugs, ids and urls', () => {
    expect(episodeSchema.safeParse({ ...episode, slug: 'حلقة' }).success).toBe(false);
    expect(episodeSchema.safeParse({ ...episode, youtube_video_id: 'short' }).success).toBe(false);
    expect(episodeSchema.safeParse({ ...episode, audio_url: 'http://insecure.example/a.mp3' }).success).toBe(false);
    expect(episodeSchema.safeParse({ ...episode, apple_episode_url: 'https://evil.example/' }).success).toBe(false);
  });
  it('requires a clip source', () => {
    const clip = { slug: 'c', title: 't', orientation: 'vertical', status: 'draft' };
    expect(clipSchema.safeParse(clip).success).toBe(false);
    expect(clipSchema.safeParse({ ...clip, youtube_video_id: 'dQw4w9WgXcQ' }).success).toBe(true);
  });
  it('validates articles and nested settings', () => {
    expect(articleSchema.safeParse({ slug: 'a', kind: 'story', title: 'x', body: '', is_featured: false, status: 'review' }).success).toBe(true);
    const settings = {
      general: { site_name: 'وارد', site_name_en: 'Wared', tagline: 'كل شيء وارد.', tagline_en: 'Anything is possible.', contact_email: '', announcement: '' },
      platforms: { spotify: '', apple_podcasts: '', youtube: '', anghami: '' },
      social: { x: 'https://x.com/wared', instagram: '', tiktok: '', youtube: '', linkedin: '' },
      brand: { display_font: 'plex' },
      notifications: { inbox_email: '' },
    };
    expect(settingsSchema.safeParse(settings).success).toBe(true);
    expect(settingsSchema.safeParse({ ...settings, social: { ...settings.social, x: 'https://evil.example' } }).success).toBe(false);
  });
  it('converts Riyadh local time to ISO and back', () => {
    expect(riyadhToIso('2026-12-01T21:00')).toBe('2026-12-01T18:00:00.000Z');
    expect(isoToRiyadhLocal('2026-12-01T18:00:00.000Z')).toBe('2026-12-01T21:00');
    expect(riyadhToIso(null)).toBeNull();
  });
});
