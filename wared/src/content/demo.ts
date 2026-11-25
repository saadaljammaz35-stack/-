/**
 * Sample content for previewing the design without a database (NEXT_PUBLIC_DEMO_CONTENT=1).
 * Every item is labelled as sample content and the site shows a banner while demo mode is on.
 * Nothing here describes a real episode, guest or statistic.
 */
import type { Article, Clip, Episode, Guest, Program } from '@/lib/types';

const studio = {
  url: '/images/studio.jpg',
  alt: 'استوديو وارد',
  altEn: 'The Wared studio',
  width: 1672,
  height: 941,
  mimeType: 'image/jpeg',
  bytes: null,
  durationSeconds: null,
};

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

export const demoProgram: Program = {
  id: 'demo-program',
  slug: 'demo-show',
  kind: 'podcast',
  title: 'برنامج تجريبي',
  titleEn: 'Sample show',
  tagline: 'برنامج تجريبي لمعاينة شكل الصفحات.',
  taglineEn: 'A sample show for previewing the pages.',
  cover: studio,
  description: 'هذا البرنامج غير حقيقي. يظهر فقط في وضع العرض لمعاينة التصميم قبل ربط قاعدة البيانات.',
  descriptionEn: 'This show is not real. It only appears in demo mode to preview the design before the database is connected.',
  hosts: null,
  language: 'ar',
  explicit: false,
  itunesCategory: 'Society & Culture',
  appleUrl: null,
  spotifyUrl: null,
  youtubeUrl: null,
  anghamiUrl: null,
  publishedAt: daysAgo(30),
  updatedAt: daysAgo(1),
};

const programSummary = {
  id: demoProgram.id,
  slug: demoProgram.slug,
  kind: demoProgram.kind,
  title: demoProgram.title,
  titleEn: demoProgram.titleEn,
  tagline: demoProgram.tagline,
  taglineEn: demoProgram.taglineEn,
  cover: demoProgram.cover,
};

const demoGuestSummary = {
  id: 'demo-guest',
  slug: 'sample-guest',
  name: 'ضيف تجريبي',
  nameEn: 'Sample guest',
  headline: 'شخصية غير حقيقية لمعاينة صفحة الضيف',
  headlineEn: 'A fictional profile for previewing the guest page',
  photo: null,
};

function demoEpisode(n: number, title: string, titleEn: string, summary: string, summaryEn: string, days: number): Episode {
  return {
    id: `demo-episode-${n}`,
    slug: `sample-episode-${n}`,
    number: n,
    season: 1,
    episodeType: 'full',
    title,
    titleEn,
    summary,
    summaryEn,
    cover: studio,
    durationSeconds: 17,
    publishedAt: daysAgo(days),
    audioUrl: '/demo/teaser.mp3',
    isFeatured: n !== 3,
    program: programSummary,
    showNotes:
      'هذه ملاحظات حلقة تجريبية.\n\nفي وضع العرض يستخدم المشغل صوت تيزر وارد (17 ثانية) لتجربة الفصول والنص المفرغ ومشاركة اللحظات.',
    showNotesEn:
      'These are sample show notes.\n\nIn demo mode the player uses the 17-second Wared teaser audio to try chapters, the transcript and moment sharing.',
    audioMime: 'audio/mpeg',
    audioBytes: null,
    youtubeVideoId: null,
    spotifyEpisodeId: null,
    appleEpisodeUrl: null,
    explicit: false,
    chapters: [
      { startSeconds: 0, title: 'قصص ما انحكت', titleEn: 'Untold stories' },
      { startSeconds: 6, title: 'أفكار تستحق نسمعها', titleEn: 'Ideas worth hearing' },
      { startSeconds: 12, title: 'كل شيء وارد', titleEn: 'Anything is possible' },
    ],
    transcript: {
      locale: 'ar',
      segments: [
        { start: 0, end: 3, text: 'فيه قصص ما انحكت.' },
        { start: 3, end: 6, text: 'وأسئلة ما انسألت.' },
        { start: 6, end: 9, text: 'وأفكار تستحق إننا نسمعها.' },
        { start: 9, end: 12, text: 'ما ندري وين بيأخذنا الحديث،' },
        { start: 12, end: 17, text: 'لكن كل شيء وارد.' },
      ],
    },
    guests: n === 1 ? [{ ...demoGuestSummary, role: 'guest' }] : [],
    updatedAt: daysAgo(days),
  };
}

export const demoEpisodes: Episode[] = [
  demoEpisode(3, 'حلقة تجريبية: عنوان طويل لمعاينة التفاف السطور في الصفحة', 'Sample episode: a long title to preview line wrapping', 'وصف قصير لحلقة تجريبية.', 'A short description of a sample episode.', 1),
  demoEpisode(2, 'حلقة تجريبية ثانية', 'Second sample episode', 'وصف حلقة تجريبية ثانية.', 'Description of a second sample episode.', 8),
  demoEpisode(1, 'حلقة تجريبية أولى', 'First sample episode', 'وصف حلقة تجريبية أولى.', 'Description of a first sample episode.', 15),
];

export const demoGuests: Guest[] = [
  {
    ...demoGuestSummary,
    bio: 'هذا الملف تجريبي لمعاينة شكل صفحة الضيف، ولا يمثل شخصًا حقيقيًا.',
    bioEn: 'This is a sample profile for previewing the guest page. It does not represent a real person.',
    websiteUrl: null,
    xHandle: null,
    instagramHandle: null,
    linkedinUrl: null,
    episodes: demoEpisodes.filter((e) => e.guests.length > 0),
  },
];

export const demoArticles: Article[] = [
  {
    id: 'demo-article-1',
    slug: 'sample-story',
    kind: 'story',
    title: 'قصة تجريبية: كيف تبدو صفحة القصة',
    titleEn: 'Sample story: what a story page looks like',
    dek: 'نص تجريبي لمعاينة التصميم التحريري للقصص الطويلة.',
    dekEn: 'Sample copy for previewing the editorial design of long stories.',
    cover: studio,
    authorName: 'فريق وارد',
    readingMinutes: 2,
    publishedAt: daysAgo(3),
    isFeatured: true,
    category: { slug: 'stories', name: 'قصص', nameEn: 'Stories' },
    body:
      '## هذا نص تجريبي\n\nيعرض هذا المقال شكل الفقرات والعناوين والاقتباسات في صفحات وارد. المحتوى الحقيقي يُكتب من لوحة التحكم.\n\n> كل شيء وارد.\n\nالفقرة الأخيرة في النص التجريبي، لمعاينة المسافات بين الفقرات وطول السطر المريح للقراءة.',
    bodyEn:
      '## This is sample copy\n\nThis article shows how paragraphs, headings and quotes look on Wared. Real content is written from the dashboard.\n\n> Anything is possible.\n\nThe last paragraph of the sample, for previewing paragraph spacing and a comfortable line length.',
    relatedEpisode: demoEpisodes[0] ?? null,
    updatedAt: daysAgo(3),
  },
  {
    id: 'demo-article-2',
    slug: 'sample-essay',
    kind: 'essay',
    title: 'تأمل تجريبي ثانٍ',
    titleEn: 'A second sample essay',
    dek: 'مقال تجريبي قصير.',
    dekEn: 'A short sample essay.',
    cover: null,
    authorName: 'فريق وارد',
    readingMinutes: 1,
    publishedAt: daysAgo(10),
    isFeatured: false,
    category: null,
    body: 'نص تجريبي قصير.',
    bodyEn: 'Short sample copy.',
    relatedEpisode: null,
    updatedAt: daysAgo(10),
  },
];

export const demoClips: Clip[] = [
  {
    id: 'demo-clip-1',
    slug: 'wared-teaser',
    title: 'تيزر وارد',
    titleEn: 'Wared teaser',
    description: 'الإعلان التشويقي لإطلاق وارد.',
    orientation: 'vertical',
    durationSeconds: 17,
    youtubeVideoId: null,
    externalUrl: null,
    videoUrl: '/demo/teaser-vertical.mp4',
    thumbnail: { ...studio, url: '/demo/teaser-vertical-poster.jpg', width: 720, height: 1280 },
    publishedAt: daysAgo(2),
    episode: null,
  },
];
