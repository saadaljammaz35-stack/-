/** أيقونات SVG خفيفة — بدون مكتبات خارجية. */
const s = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

export const ICONS = {
  settings: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.6.77 1 1.42 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  search: s('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  bookmark: s('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'),
  bookmarkFill: s('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="currentColor"/>'),
  play: s('<path d="M6 4l14 8-14 8z" fill="currentColor"/>'),
  back: s('<path d="M9 6l6 6-6 6"/>'),
  close: s('<path d="M18 6 6 18M6 6l12 12"/>'),
  moon: s('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  sun: s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  sunrise: s('<path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/>'),
  sunset: s('<path d="M17 18a5 5 0 0 0-10 0M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M16 5l-4 4-4-4"/>'),
  mosque: s('<path d="M12 2c2 2 3 3.2 3 4.8S13.7 9 12 9s-3-.7-3-2.2S10 4 12 2z"/><path d="M4 21v-7a8 8 0 0 1 16 0v7M2 21h20M9 21v-4a3 3 0 0 1 6 0v4"/>'),
  kaaba: s('<path d="M12 2 3 6.5v11L12 22l9-4.5v-11z"/><path d="M3 6.5 12 11l9-4.5M12 11v11"/><path d="M3 12h18"/>'),
  compass: s('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5z" fill="currentColor"/>'),
  book: s('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  quran: s('<path d="M12 6.3C10.5 4.8 8.6 4 6.5 4H3v14h3.5c2.1 0 4 .8 5.5 2.3M12 6.3c1.5-1.5 3.4-2.3 5.5-2.3H21v14h-3.5c-2.1 0-4 .8-5.5 2.3M12 6.3v14"/>'),
  hadith: s('<path d="M4 4h16v14H7l-3 3z"/><path d="M8 9h8M8 13h5"/>'),
  beads: s('<circle cx="12" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="15" r="2"/><circle cx="6" cy="8" r="2"/><circle cx="4" cy="15" r="2"/><circle cx="12" cy="20" r="2"/>'),
  heart: s('<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1z"/>'),
  heartFill: s('<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1z" fill="currentColor"/>'),
  bell: s('<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>'),
  copy: s('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  share: s('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  check: s('<path d="M20 6 9 17l-5-5"/>'),
  refresh: s('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>'),
  plus: s('<path d="M12 5v14M5 12h14"/>'),
  minus: s('<path d="M5 12h14"/>'),
  location: s('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
  calendar: s('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  hand: s('<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v7M10 10.5V6a2 2 0 0 0-4 0v9"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8"/>'),
  gift: s('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M12 8a3.5 3.5 0 1 1 3.5-3.5A3.5 3.5 0 0 1 12 8zM12 8A3.5 3.5 0 1 0 8.5 4.5 3.5 3.5 0 0 0 12 8z"/>'),
  star: s('<path d="m12 2 2.9 6.3 6.8.8-5 4.7 1.3 6.7L12 17.3 6 20.5l1.3-6.7-5-4.7 6.8-.8z"/>'),
  bed: s('<path d="M2 18v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6M2 18h20M2 18v3M22 18v3"/><path d="M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>'),
  road: s('<path d="M4 22 8 2M20 22 16 2M12 4v3M12 11v3M12 18v3"/>'),
  home: s('<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
  info: s('<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>'),
  reset: s('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  download: s('<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>'),
  chevron: s('<path d="m15 6-6 6 6 6"/>'),
  eye: s('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  volume: s('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/>'),
  fajr: s('<path d="M17 18a5 5 0 0 0-10 0"/><path d="M12 3v3M5 8l1.5 1.5M19 8l-1.5 1.5M2 18h2M20 18h2M2 22h20"/>'),
  dhuhr: s('<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2 12h2M20 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5"/>'),
  asr: s('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M20 12h2M5.5 5.5 7 7M18.5 5.5 17 7M2 12h2M12 19v2"/>'),
  maghrib: s('<path d="M17 18a5 5 0 0 0-10 0"/><path d="M12 9V3M8 6l4 4 4-4M2 18h2M20 18h2M2 22h20"/>'),
  isha: s('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/><path d="M18 4.5v-2M17 3.5h2"/>'),
  prayer: s('<path d="M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/><path d="M9 21v-5l-2-4 2-3h6l2 3-2 4v5"/>')
};

/** شعار التطبيق — نجمة إسلامية ثمانية */
export const LOGO = `
<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4"
  stroke-linejoin="round" aria-hidden="true">
  <path d="M50 8 62 20h17v17l12 13-12 13v17H62L50 92 38 80H21V63L9 50l12-13V20h17z"/>
  <path d="M50 22 63 35h13v13l12 2-12 2v13H63L50 78 37 65H24V52l-12-2 12-2V35h13z" opacity=".55"/>
</svg>`;

/** خيارات أيقونة التطبيق القابلة للتغيير */
export const APP_ICONS = {
  star: { name: 'النجمة الثمانية', emoji: '✦' },
  kaaba: { name: 'الكعبة', emoji: '🕋' },
  mosque: { name: 'المسجد', emoji: '🕌' },
  moon: { name: 'الهلال', emoji: '☾' },
  quran: { name: 'المصحف', emoji: '📖' },
  beads: { name: 'المسبحة', emoji: '📿' }
};

export const icon = (name) => ICONS[name] || ICONS.info;
