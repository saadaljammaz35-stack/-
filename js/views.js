/** شاشات التطبيق */
import { h, ar, toast, sheet, copyText, shareText, vibrate, daysWord, pagesWord, esc } from './ui.js';
import { ICONS, LOGO, APP_ICONS } from './icons.js';
import { store, isFavorite, toggleFavorite, touchStreak } from './store.js';
import { ADHKAR, ADHKAR_ORDER } from '../data/adhkar.js';
import { DUAS, DUAS_ORDER, DUA_ETIQUETTE } from '../data/duas.js';
import { HADITH_SECTIONS, HADITH_ORDER } from '../data/hadith.js';
import { ASMA_HUSNA } from '../data/asma-husna.js';
import { SURAHS, TOTAL_PAGES, pageToJuz, pageToSurah, juzStartPage } from '../data/surahs.js';
import { nextPrayer, formatTime, formatRemaining, PRAYER_META, METHODS, ASR_METHODS } from './prayer.js';
import { fullDateLine, formatHijri, formatGregorian, weekdayName, ramadanStatus, upcomingOccasions, sunnahFastToday } from './hijri.js';
import { qiblaBearing, distanceToKaaba, bearingToDirection, startCompass, getCurrentPosition, CITIES } from './qibla.js';
import { khatmahStatus, startKhatmah, cancelKhatmah, markPage, addPages, PRESETS, pagesPerDay } from './khatmah.js';
import { fetchPage, prefetchPages, cachedPagesCount, clearQuranCache } from './quran.js';
import * as notify from './notify.js';

/* ————— مساعدات ————— */
const deviceTimeZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
};

const iconHTML = (name) => ICONS[name] || ICONS.info;

const prayerOpts = () => {
  const loc = store.get('location');
  return {
    lat: loc.lat, lng: loc.lng, timeZone: loc.tz || null,
    method: store.get('method'),
    asrMethod: store.get('asrMethod'),
    adjustments: store.get('adjustments'),
    isRamadan: ramadanStatus(new Date(), store.get('hijriOffset', 0)).isRamadan
  };
};

const t24 = () => store.get('time24', false);
const tz = () => store.get('location.tz', null);

function pillLink(label, hash, { color, sub, wide } = {}) {
  return h('a', {
    class: 'pill' + (wide ? ' pill--wide' : ''),
    href: hash,
    style: color ? `--tile:${color}` : ''
  }, h('span', { text: label }), sub ? h('small', { text: sub }) : null);
}

function subhead(title, sub, backTo = '#/home') {
  return h('div', { class: 'subhead' },
    h('a', { class: 'icon-btn', href: backTo, 'aria-label': 'رجوع', html: iconHTML('back') }),
    h('div', { class: 'subhead__title' },
      h('b', { text: title }),
      sub ? h('span', { text: sub }) : null)
  );
}

/* ===========================================================
   الرئيسية — المنوعة
   =========================================================== */
export function viewHome() {
  const wrap = h('div', { class: 'screen' });
  const now = new Date();
  const off = store.get('hijriOffset', 0);
  const ram = ramadanStatus(now, off);

  // بطاقة اليوم
  const np = nextPrayer(now, prayerOpts());
  const rem = formatRemaining(np.remaining);
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'card__head' },
      h('div', {},
        h('div', { class: 'card__title', text: `${weekdayName(now)} — ${formatHijri(now, off)}` }),
        h('div', { class: 'card__sub', text: formatGregorian(now) })),
      h('a', { class: 'icon-btn', href: '#/prayer', 'aria-label': 'مواقيت الصلاة', html: iconHTML('mosque') })
    ),
    h('div', { class: 'stat-row' },
      h('div', { class: 'stat' }, h('b', { text: np.next.name }), h('span', { text: 'الصلاة القادمة' })),
      h('div', { class: 'stat' }, h('b', { text: formatTime(np.next.time, t24(), tz()) }), h('span', { text: 'موعدها' })),
      h('div', { class: 'stat' }, h('b', { text: rem.text }), h('span', { text: 'المتبقّي' }))
    ),
    sunnahFastToday(now, off).length
      ? h('div', { class: 'notice', style: 'margin-top:12px;margin-bottom:0',
          text: 'صيام اليوم: ' + sunnahFastToday(now, off).join(' · ') })
      : null
  ));

  // بطاقات كبيرة
  wrap.append(h('div', { class: 'grid grid--one' },
    pillLink('القرآن الكريم والختمة', '#/quran', { color: '#2f9e8f', sub: khatmahSubtitle(), wide: true }),
    pillLink('الأحاديث النبوية', '#/hadith', { color: '#5b7553', sub: 'الأربعون النووية ومنتخبات الصحيحين', wide: true }),
    pillLink('بث مباشر من مكة المكرمة', '#/live', { color: '#3f6fd8', sub: 'الحرمان الشريفان', wide: true })
  ));

  wrap.append(h('div', { class: 'section-title', text: 'الأذكار' }));
  wrap.append(h('div', { class: 'grid' },
    pillLink('أذكار الصباح', '#/list/adhkar/morning', { color: '#3aa0d8' }),
    pillLink('أذكار المساء', '#/list/adhkar/evening', { color: '#e2626b' }),
    pillLink('أذكاري', '#/favorites', { color: '#4bbfae' }),
    pillLink('أسماء الله الحسنى', '#/names', { color: '#d0625f' }),
    pillLink('أذكار الصلاة', '#/list/adhkar/prayer', { color: '#d8a13f' }),
    pillLink('أذكار بعد الصلاة', '#/list/adhkar/afterPrayer', { color: '#3f6fd8' }),
    pillLink('أذكار النوم', '#/list/adhkar/sleep', { color: '#c45ec4' }),
    pillLink('أذكار الاستيقاظ', '#/list/adhkar/waking', { color: '#d08fd0' }),
    pillLink('أذكار المسجد', '#/list/adhkar/mosque', { color: '#2f9e8f' }),
    pillLink('أذكار المنزل', '#/list/adhkar/home', { color: '#c98a4b' }),
    pillLink('أذكار السفر', '#/list/adhkar/travel', { color: '#4f9fbf' }),
    pillLink('الهمّ والكرب', '#/list/adhkar/distress', { color: '#7a8fd8' })
  ));

  wrap.append(h('div', { class: 'section-title', text: 'الأدعية' }));
  wrap.append(h('div', { class: 'grid' },
    pillLink('أدعية من القرآن', '#/list/duas/quranDuas', { color: '#6b7280' }),
    pillLink('من دعاء الرسول ﷺ', '#/list/duas/prophetDuas', { color: '#d8a13f' }),
    pillLink('الرقية بالسنة', '#/list/duas/ruqyahSunnah', { color: '#2f9e8f' }),
    pillLink('الرقية بالقرآن', '#/list/duas/ruqyahQuran', { color: '#e08a5a' }),
    pillLink('تسابيح', '#/list/duas/tasbeeh', { color: '#3f8fd8' }),
    pillLink('الحمد والثناء', '#/list/duas/praise', { color: '#c9a24b' }),
    pillLink('الإستغفار', '#/list/duas/istighfar', { color: '#8a8f98' }),
    pillLink('مختصر الأدعية', '#/list/duas/brief', { color: '#8b8b8b' }),
    pillLink('أدعية الميت', '#/list/duas/deceased', { color: '#6f7f8f' }),
    pillLink('آداب الدعاء', '#/etiquette', { color: '#5b7553' })
  ));

  wrap.append(h('div', { class: 'grid grid--one', style: 'margin-top:11px' },
    pillLink('أدعية شاملة', '#/list/duas/comprehensive', { color: '#5b7553', sub: 'جوامع الدعاء', wide: true }),
    pillLink(ram.isRamadan ? 'أدعية رمضان والعشر الأواخر' : 'أدعية رمضان', '#/list/duas/ramadan',
      { color: '#5b8f5b', sub: ram.isRamadan ? `اليوم ${ar(ram.day)} من رمضان` : 'الصيام وليلة القدر', wide: true }),
    pillLink('أقسام الأدعية', '#/sections', { color: '#7a7a7a', sub: 'كل الأبواب في مكان واحد', wide: true })
  ));

  wrap.append(h('div', { class: 'section-title', text: 'أخرى' }));
  wrap.append(h('div', { class: 'grid' },
    pillLink('المسبحة', '#/counter', { color: '#5b7553' }),
    pillLink('القبلة', '#/qibla', { color: '#c98a4b' }),
    pillLink('إحسان للتبرع', '#/donate', { color: '#2f9e8f' }),
    pillLink('الإعدادات', '#/settings', { color: '#6b7280' })
  ));

  return wrap;
}

function khatmahSubtitle() {
  const st = khatmahStatus();
  if (!st) return 'ابدأ ختمتك اليوم';
  if (st.completed) return 'تمّت الختمة — بارك الله فيك';
  return `اليوم ${ar(st.dayNumber)} · بقي ${pagesWord(st.remainingPages)} · ورد اليوم ${ar(st.todayRemaining)}`;
}

/* ===========================================================
   أقسام الأدعية والأذكار
   =========================================================== */
export function viewSections() {
  const wrap = h('div', { class: 'screen' });
  wrap.append(subhead('أقسام الأدعية والأذكار', 'كل الأبواب مرتّبة'));

  wrap.append(h('div', { class: 'section-title', text: 'الأذكار' }));
  wrap.append(h('div', { class: 'grid grid--one' },
    ...ADHKAR_ORDER.map((k) => pillLink(ADHKAR[k].title, `#/list/adhkar/${k}`,
      { color: ADHKAR[k].accent, sub: ADHKAR[k].subtitle, wide: true }))
  ));

  wrap.append(h('div', { class: 'section-title', text: 'الأدعية' }));
  wrap.append(h('div', { class: 'grid grid--one' },
    ...DUAS_ORDER.map((k) => pillLink(DUAS[k].title, `#/list/duas/${k}`,
      { color: DUAS[k].accent, sub: DUAS[k].subtitle, wide: true }))
  ));

  wrap.append(h('div', { class: 'section-title', text: 'الأحاديث' }));
  wrap.append(h('div', { class: 'grid grid--one' },
    ...HADITH_ORDER.map((k) => pillLink(HADITH_SECTIONS[k].title, `#/hadith/${k}`,
      { color: HADITH_SECTIONS[k].accent, sub: HADITH_SECTIONS[k].subtitle, wide: true }))
  ));

  return wrap;
}

/* ===========================================================
   قارئ الأذكار والأدعية
   =========================================================== */
export function viewList(kind, id) {
  const source = kind === 'adhkar' ? ADHKAR : DUAS;
  const section = source[id];
  const wrap = h('div', { class: 'screen' });
  if (!section) {
    wrap.append(subhead('غير موجود', ''), h('div', { class: 'empty' }, h('p', { text: 'هذا القسم غير متوفّر.' })));
    return wrap;
  }

  wrap.append(subhead(section.title, section.subtitle));

  const todayISO = new Date().toISOString().slice(0, 10);
  const progKey = `${kind}:${id}`;
  let prog = store.get(`progress.${progKey}`);
  if (!prog || prog.date !== todayISO) prog = { date: todayISO, counts: {} };

  const strip = h('div', { class: 'progress-strip' },
    h('div', { class: 'progress-strip__track' }, h('div', { class: 'progress-strip__fill' })),
    h('span', { class: 'progress-strip__text' }),
    h('button', { class: 'btn btn--sm', html: iconHTML('reset'), 'aria-label': 'إعادة', onclick: resetAll })
  );
  wrap.append(strip);

  const cards = section.items.map((item, i) => buildDhikrCard(item, i));
  cards.forEach((c) => wrap.append(c.node));
  updateStrip();

  function buildDhikrCard(item, index) {
    const target = item.count || 1;
    const key = String(index);
    const node = h('div', { class: 'dhikr', style: `--tile:${section.accent}` });
    const favId = `${kind}:${id}:${index}`;

    const counter = h('button', { class: 'counter-chip', style: `--tile:${section.accent}` });
    const favBtn = h('button', { class: 'dhikr__btn', 'aria-label': 'إضافة للمفضلة', html: iconHTML('heart') });

    const refresh = () => {
      const done = prog.counts[key] || 0;
      const left = Math.max(0, target - done);
      counter.textContent = left === 0 ? '✓' : ar(left);
      counter.classList.toggle('is-done', left === 0);
      node.classList.toggle('is-done', left === 0);
    };

    counter.addEventListener('click', () => {
      const done = (prog.counts[key] || 0) + 1;
      prog.counts[key] = Math.min(target, done);
      store.set(`progress.${progKey}`, prog);
      vibrate(10);
      refresh();
      updateStrip();
      touchStreak();
      if (prog.counts[key] >= target) {
        const next = cards[index + 1];
        if (next) setTimeout(() => next.node.scrollIntoView({ behavior: 'smooth', block: 'center' }), 240);
      }
    });

    const favState = () => {
      const on = isFavorite(favId);
      favBtn.innerHTML = on ? iconHTML('heartFill') : iconHTML('heart');
      favBtn.classList.toggle('is-on', on);
    };
    favBtn.addEventListener('click', () => {
      const added = toggleFavorite({
        id: favId, type: kind, section: section.title,
        title: section.title, text: item.text, source: item.source, count: item.count
      });
      favState();
      toast(added ? 'أُضيف إلى أذكاري' : 'أُزيل من أذكاري');
    });

    node.append(
      h('div', { class: 'dhikr__text', text: item.text }),
      item.virtue ? h('div', { class: 'dhikr__virtue', text: item.virtue }) : null,
      h('div', { class: 'dhikr__foot' },
        h('div', { class: 'dhikr__source', text: item.source || '' }),
        h('div', { class: 'dhikr__actions' },
          favBtn,
          h('button', { class: 'dhikr__btn', 'aria-label': 'نسخ', html: iconHTML('copy'),
            onclick: () => copyText(`${item.text}\n\n${item.source || ''}`) }),
          h('button', { class: 'dhikr__btn', 'aria-label': 'مشاركة', html: iconHTML('share'),
            onclick: () => shareText(`${item.text}\n\n${item.source || ''}\n\nمن تطبيق: مع الله`) }),
          counter
        ))
    );
    favState();
    refresh();
    return { node, refresh };
  }

  function updateStrip() {
    const total = section.items.reduce((s, it) => s + (it.count || 1), 0);
    const done = section.items.reduce((s, it, i) => s + Math.min(it.count || 1, prog.counts[String(i)] || 0), 0);
    const pct = total ? (done / total) * 100 : 0;
    strip.querySelector('.progress-strip__fill').style.width = pct + '%';
    strip.querySelector('.progress-strip__text').textContent = `${ar(Math.round(pct))}٪`;
  }

  function resetAll() {
    prog = { date: todayISO, counts: {} };
    store.set(`progress.${progKey}`, prog);
    cards.forEach((c) => c.refresh());
    updateStrip();
    toast('تمت إعادة العدّ');
  }

  return wrap;
}

/* ===========================================================
   آداب الدعاء
   =========================================================== */
export function viewEtiquette() {
  const wrap = h('div', { class: 'screen' });
  wrap.append(subhead(DUA_ETIQUETTE.title, 'ما يعين على قبول الدعاء'));
  for (const sec of DUA_ETIQUETTE.sections) {
    wrap.append(h('div', { class: 'card' },
      h('div', { class: 'card__title', text: sec.heading, style: 'margin-bottom:10px' }),
      ...sec.points.map((p) => h('div', {
        style: 'display:flex;gap:9px;padding:7px 0;font-size:.92rem;line-height:1.9'
      }, h('span', { text: '•', style: 'color:var(--accent);font-weight:800' }), h('span', { text: p })))
    ));
  }
  return wrap;
}

/* ===========================================================
   أسماء الله الحسنى
   =========================================================== */
export function viewNames() {
  const wrap = h('div', { class: 'screen' });
  wrap.append(subhead('أسماء الله الحسنى', 'من أحصاها دخل الجنة'));
  wrap.append(h('div', { class: 'notice',
    text: 'قال ﷺ: «إن لله تسعة وتسعين اسمًا، مئة إلا واحدًا، من أحصاها دخل الجنة» — رواه البخاري ٢٧٣٦ ومسلم ٢٦٧٧.' }));

  const grid = h('div', { class: 'names-grid' });
  ASMA_HUSNA.forEach((n, i) => {
    grid.append(h('button', {
      class: 'name-card',
      onclick: () => sheet(n.name, h('div', {},
        h('p', { text: n.meaning, style: 'line-height:2;font-size:.95rem' }),
        h('div', { class: 'btn-row', style: 'margin-top:14px' },
          h('button', { class: 'btn btn--sm', text: 'نسخ', onclick: () => copyText(`${n.name}: ${n.meaning}`) }),
          h('button', {
            class: 'btn btn--sm', text: 'ذكر بالمسبحة',
            onclick: () => { store.set('counter.label', n.name); store.set('counter.value', 0); location.hash = '#/counter'; }
          })
        )))
    }, h('b', { text: n.name }), h('span', { text: ar(i + 1) })));
  });
  wrap.append(grid);
  return wrap;
}

/* ===========================================================
   الأحاديث
   =========================================================== */
export function viewHadithIndex() {
  const wrap = h('div', { class: 'screen' });
  wrap.append(subhead('الأحاديث النبوية', 'من الصحيحين والسنن'));
  wrap.append(h('div', { class: 'grid grid--one' },
    ...HADITH_ORDER.map((k) => pillLink(HADITH_SECTIONS[k].title, `#/hadith/${k}`, {
      color: HADITH_SECTIONS[k].accent,
      sub: `${HADITH_SECTIONS[k].subtitle} · ${ar(HADITH_SECTIONS[k].items.length)} حديثًا`,
      wide: true
    }))
  ));
  return wrap;
}

export function viewHadithSection(id) {
  const sec = HADITH_SECTIONS[id];
  const wrap = h('div', { class: 'screen' });
  if (!sec) { wrap.append(subhead('غير موجود', '', '#/hadith')); return wrap; }
  wrap.append(subhead(sec.title, sec.subtitle, '#/hadith'));

  sec.items.forEach((it, i) => {
    const favId = `hadith:${id}:${i}`;
    const favBtn = h('button', { class: 'dhikr__btn', 'aria-label': 'حفظ', html: iconHTML('bookmark') });
    const sync = () => {
      const on = isFavorite(favId);
      favBtn.innerHTML = on ? iconHTML('bookmarkFill') : iconHTML('bookmark');
      favBtn.classList.toggle('is-on', on);
    };
    favBtn.addEventListener('click', () => {
      const added = toggleFavorite({ id: favId, type: 'hadith', section: sec.title, title: sec.title, text: it.text, source: it.source });
      sync();
      toast(added ? 'حُفظ الحديث' : 'أُزيل الحديث');
    });
    sync();

    wrap.append(h('div', { class: 'hadith', style: `--tile:${sec.accent}` },
      it.n ? h('div', { class: 'hadith__n', text: `الحديث ${ar(it.n)}` }) : null,
      h('div', { class: 'hadith__text', text: it.text }),
      h('div', { class: 'dhikr__foot' },
        h('div', { class: 'hadith__source', text: it.source }),
        h('div', { class: 'dhikr__actions' },
          favBtn,
          h('button', { class: 'dhikr__btn', 'aria-label': 'نسخ', html: iconHTML('copy'),
            onclick: () => copyText(`${it.text}\n${it.source}`) }),
          h('button', { class: 'dhikr__btn', 'aria-label': 'مشاركة', html: iconHTML('share'),
            onclick: () => shareText(`${it.text}\n${it.source}\n\nمن تطبيق: مع الله`) })
        ))
    ));
  });
  return wrap;
}

/* ===========================================================
   مواقيت الصلاة
   =========================================================== */
export function viewPrayer() {
  const wrap = h('div', { class: 'screen' });
  const loc = store.get('location');
  const now = new Date();
  const off = store.get('hijriOffset', 0);

  wrap.append(h('div', { class: 'subhead' },
    h('div', { class: 'subhead__title' },
      h('b', { text: 'مواقيت الصلاة' }),
      h('span', { text: `${loc.city} · ${fullDateLine(now, off)}` })),
    h('button', { class: 'icon-btn', 'aria-label': 'تحديد الموقع', html: iconHTML('location'),
      onclick: locateNow })
  ));

  const card = h('div', { class: 'next-prayer' });
  wrap.append(card);
  const list = h('div');
  wrap.append(list);

  function paint() {
    const np = nextPrayer(new Date(), prayerOpts());
    const r = formatRemaining(np.remaining);
    card.innerHTML = '';
    card.append(
      h('div', { class: 'next-prayer__label', text: 'الصلاة القادمة' }),
      h('div', { class: 'next-prayer__name', text: np.next.name }),
      h('div', { class: 'next-prayer__time', text: formatTime(np.next.time, t24(), tz()) }),
      h('div', { class: 'next-prayer__count',
        text: `${ar(String(r.h).padStart(2, '0'))}:${ar(String(r.m).padStart(2, '0'))}:${ar(String(r.s).padStart(2, '0'))}` }),
      h('div', { class: 'next-prayer__hint', text: 'المتبقّي على الأذان' })
    );

    const times = np.times;
    list.innerHTML = '';
    for (const meta of PRAYER_META) {
      const time = times[meta.key];
      const isNext = np.next.key === meta.key && np.next.time.getTime() === time?.getTime();
      const isPast = time < new Date() && !isNext;
      list.append(h('div', { class: `prayer-row${isNext ? ' is-next' : ''}${isPast ? ' is-past' : ''}` },
        h('div', { class: 'prayer-row__icon', html: iconHTML(meta.icon) }),
        h('div', { class: 'prayer-row__name', text: meta.name }),
        isNext ? h('div', { class: 'prayer-row__badge', text: 'القادمة' }) : null,
        h('div', { class: 'prayer-row__time', text: formatTime(time, t24(), tz()) })
      ));
    }

    const ram = ramadanStatus(new Date(), off);
    if (ram.isRamadan) {
      list.append(h('div', { class: 'prayer-row' },
        h('div', { class: 'prayer-row__icon', html: iconHTML('sunrise') }),
        h('div', { class: 'prayer-row__name', text: 'الإمساك' }),
        h('div', { class: 'prayer-row__time', text: formatTime(times.imsak, t24(), tz()) })
      ));
    }
  }
  paint();
  const timer = setInterval(paint, 1000);
  wrap.addEventListener('screen:leave', () => clearInterval(timer));

  // المناسبات
  const occ = upcomingOccasions(now, off, 3);
  if (occ.length) {
    wrap.append(h('div', { class: 'section-title', text: 'مناسبات قادمة' }));
    wrap.append(h('div', { class: 'card' },
      ...occ.map((o) => h('div', { class: 'switch-row' },
        h('div', { class: 'switch-row__text' }, h('b', { text: o.name })),
        h('span', { class: 'card__sub', text: o.inDays === 0 ? 'اليوم' : `بعد ${daysWord(o.inDays)}` })
      ))
    ));
  }

  wrap.append(h('div', { class: 'btn-row', style: 'margin-top:14px' },
    h('a', { class: 'btn', href: '#/qibla', html: iconHTML('compass') + '<span>القبلة</span>' }),
    h('a', { class: 'btn', href: '#/settings', html: iconHTML('bell') + '<span>التنبيهات</span>' })
  ));

  async function locateNow() {
    toast('جارٍ تحديد الموقع…');
    try {
      const pos = await getCurrentPosition();
      store.set('location', { ...pos, city: 'موقعي الحالي', tz: deviceTimeZone(), auto: true });
      toast('تم تحديد الموقع');
      location.reload();
    } catch (e) { toast(e.message); }
  }

  return wrap;
}

/* ===========================================================
   القبلة
   =========================================================== */
export function viewQibla() {
  const wrap = h('div', { class: 'screen' });
  const loc = store.get('location');
  const bearing = qiblaBearing(loc.lat, loc.lng);
  const dist = distanceToKaaba(loc.lat, loc.lng);

  wrap.append(subhead('اتجاه القبلة', `${loc.city} · ${bearingToDirection(bearing)}`));

  const dial = h('div', { class: 'compass__dial', html: compassDialSVG() });
  const needle = h('div', { class: 'compass__needle', html: needleSVG() });
  const compass = h('div', { class: 'compass' }, dial, needle,
    h('div', { class: 'compass__center', text: '🕋' }));
  wrap.append(compass);

  const info = h('div', { class: 'compass-info' },
    h('div', {}, h('span', { text: 'زاوية القبلة' }), h('b', { text: `${ar(Math.round(bearing))}°` })),
    h('div', {}, h('span', { text: 'المسافة للكعبة' }), h('b', { text: `${ar(dist)} كم` })),
    h('div', {}, h('span', { text: 'الاتجاه' }), h('b', { text: bearingToDirection(bearing) }))
  );
  wrap.append(info);

  needle.style.transform = `rotate(${bearing}deg)`;

  const status = h('div', { class: 'notice', style: 'margin-top:16px',
    text: 'اضغط «تشغيل البوصلة» ثم وجّه أعلى الجهاز نحو السهم الأخضر. ضع الجهاز مستويًا بعيدًا عن المعادن.' });
  wrap.append(status);

  let stop = null;
  const btn = h('button', {
    class: 'btn btn--primary btn--block',
    html: iconHTML('compass') + '<span>تشغيل البوصلة</span>',
    onclick: async () => {
      if (stop) { stop(); stop = null; btn.querySelector('span').textContent = 'تشغيل البوصلة'; dial.style.transform = ''; return; }
      stop = await startCompass((heading) => {
        dial.style.transform = `rotate(${-heading}deg)`;
        needle.style.transform = `rotate(${bearing - heading}deg)`;
        const diff = Math.abs(((bearing - heading + 540) % 360) - 180);
        if (diff < 5) { status.textContent = 'أنت الآن مواجه للقبلة تمامًا — بارك الله فيك.'; status.classList.remove('notice--warn'); }
        else { status.textContent = `أدر الجهاز ${ar(Math.round(diff))}° ${((bearing - heading + 360) % 360) < 180 ? 'يمينًا' : 'يسارًا'}`; status.classList.add('notice--warn'); }
      }, (err) => { status.textContent = err; status.classList.add('notice--warn'); });
      btn.querySelector('span').textContent = 'إيقاف البوصلة';
    }
  });
  wrap.append(h('div', { style: 'margin-top:12px' }, btn));
  wrap.addEventListener('screen:leave', () => stop?.());

  return wrap;
}

function compassDialSVG() {
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const long = i % 6 === 0;
    return `<line x1="50" y1="${long ? 5 : 7}" x2="50" y2="${long ? 12 : 10}"
      stroke="currentColor" stroke-width="${long ? 1.1 : .5}" opacity="${long ? .7 : .3}"
      transform="rotate(${i * 5} 50 50)"/>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" style="width:100%;height:100%;color:var(--text-3)">
    <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width=".6" opacity=".35"/>
    ${ticks}
    <text x="50" y="22" text-anchor="middle" font-size="8" fill="currentColor" font-weight="700">ش</text>
    <text x="50" y="83" text-anchor="middle" font-size="7" fill="currentColor">ج</text>
    <text x="18" y="53" text-anchor="middle" font-size="7" fill="currentColor">غ</text>
    <text x="82" y="53" text-anchor="middle" font-size="7" fill="currentColor">ق</text>
  </svg>`;
}

function needleSVG() {
  return `<svg viewBox="0 0 100 100" style="width:100%;height:100%;color:var(--accent)">
    <path d="M50 10 L57 34 L50 30 L43 34 Z" fill="currentColor"/>
    <line x1="50" y1="30" x2="50" y2="66" stroke="currentColor" stroke-width="2" opacity=".45"/>
  </svg>`;
}

/* ===========================================================
   المسبحة
   =========================================================== */
export function viewCounter() {
  const wrap = h('div', { class: 'screen' });
  wrap.append(subhead('المسبحة', 'العدّاد الإلكتروني'));

  const c = store.get('counter');
  const R = 130;
  const circ = 2 * Math.PI * R;

  const value = h('div', { class: 'tasbeeh__value', text: ar(c.value) });
  const ring = h('div', { class: 'tasbeeh__ring', html:
    `<svg viewBox="0 0 300 300" style="width:100%;height:100%">
      <circle class="bg" cx="150" cy="150" r="${R}"/>
      <circle class="fg" cx="150" cy="150" r="${R}"
        stroke-dasharray="${circ}" stroke-dashoffset="${circ}"/>
    </svg>` });

  const label = h('div', { class: 'tasbeeh__label', text: c.label });
  const sub = h('div', { class: 'tasbeeh__sub', text: `الهدف: ${ar(c.target)} · الإجمالي: ${ar(c.total)}` });

  const btn = h('button', { class: 'tasbeeh__btn', 'aria-label': 'عدّ' },
    ring, h('div', {}, value, h('div', { class: 'tasbeeh__target', text: `/ ${ar(c.target)}` })));

  const paint = () => {
    const st = store.get('counter');
    value.textContent = ar(st.value);
    label.textContent = st.label;
    sub.textContent = `الهدف: ${ar(st.target)} · الإجمالي: ${ar(st.total)}`;
    btn.querySelector('.tasbeeh__target').textContent = `/ ${ar(st.target)}`;
    const pct = Math.min(1, st.value / (st.target || 1));
    ring.querySelector('.fg').setAttribute('stroke-dashoffset', String(circ * (1 - pct)));
  };

  btn.addEventListener('click', () => {
    const st = store.get('counter');
    st.value += 1;
    st.total += 1;
    vibrate(12);
    if (st.value >= st.target) {
      st.sessions += 1;
      st.value = 0;
      vibrate([20, 60, 20]);
      toast(`أتممت ${ar(st.target)} — تقبّل الله`);
    }
    store.set('counter', st);
    touchStreak();
    paint();
  });

  const presets = ['سبحان الله', 'الحمد لله', 'لا إله إلا الله', 'الله أكبر',
    'أستغفر الله', 'لا حول ولا قوة إلا بالله', 'اللهم صلِّ على محمد', 'سبحان الله وبحمده'];

  wrap.append(h('div', { class: 'tasbeeh' }, label, sub, btn,
    h('div', { class: 'tasbeeh__row' },
      h('button', { class: 'btn btn--sm', html: iconHTML('reset') + '<span>تصفير</span>',
        onclick: () => { const st = store.get('counter'); st.value = 0; store.set('counter', st); paint(); } }),
      ...[33, 99, 100, 1000].map((n) => h('button', {
        class: 'btn btn--sm', text: ar(n),
        onclick: () => { const st = store.get('counter'); st.target = n; st.value = 0; store.set('counter', st); paint(); }
      }))
    ),
    h('div', { class: 'chip-row', style: 'margin-top:18px;justify-content:center' },
      ...presets.map((p) => h('button', {
        class: 'chip', text: p, 'aria-pressed': store.get('counter.label') === p,
        onclick: (e) => {
          const st = store.get('counter');
          st.label = p; st.value = 0;
          store.set('counter', st);
          wrap.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          e.currentTarget.setAttribute('aria-pressed', 'true');
          paint();
        }
      }))
    )
  ));

  paint();
  return wrap;
}

/* ===========================================================
   المفضلة — أذكاري
   =========================================================== */
export function viewFavorites() {
  const wrap = h('div', { class: 'screen' });
  wrap.append(subhead('أذكاري', 'ما حفظته من أذكار وأدعية وأحاديث'));

  const favs = store.get('favorites', []);
  if (!favs.length) {
    wrap.append(h('div', { class: 'empty' },
      h('div', { html: iconHTML('heart'), style: 'display:flex;justify-content:center' }),
      h('p', { text: 'لم تُضِف شيئًا بعد.\nاضغط على أيقونة القلب بجانب أي ذكر لتحفظه هنا.' })));
    return wrap;
  }

  favs.forEach((f) => {
    const node = h('div', { class: 'dhikr' },
      h('div', { class: 'card__sub', text: f.section || '', style: 'margin-bottom:8px' }),
      h('div', { class: 'dhikr__text', text: f.text }),
      h('div', { class: 'dhikr__foot' },
        h('div', { class: 'dhikr__source', text: f.source || '' }),
        h('div', { class: 'dhikr__actions' },
          h('button', { class: 'dhikr__btn is-on', html: iconHTML('heartFill'), 'aria-label': 'إزالة',
            onclick: () => { toggleFavorite(f); node.remove(); toast('أُزيل'); } }),
          h('button', { class: 'dhikr__btn', html: iconHTML('copy'), 'aria-label': 'نسخ',
            onclick: () => copyText(`${f.text}\n${f.source || ''}`) })
        ))
    );
    wrap.append(node);
  });
  return wrap;
}

/* ===========================================================
   القرآن والختمة
   =========================================================== */
export function viewQuran() {
  const wrap = h('div', { class: 'screen' });
  wrap.append(subhead('القرآن الكريم', 'الختمة والقراءة والفهرس'));

  wrap.append(khatmahCard());

  wrap.append(h('div', { class: 'section-title', text: 'القراءة' }));
  const last = store.get('lastRead');
  wrap.append(h('div', { class: 'grid grid--one' },
    pillLink(last ? 'متابعة القراءة' : 'فتح المصحف', `#/mushaf/${last?.page || 1}`, {
      color: '#2f9e8f', wide: true,
      sub: last ? `صفحة ${ar(last.page)} · ${pageToSurah(last.page).name}` : 'من الصفحة الأولى'
    })
  ));

  wrap.append(h('div', { class: 'section-title', text: 'فهرس السور' }));
  const search = h('input', { class: 'search-input', type: 'search', placeholder: 'ابحث عن سورة…' });
  wrap.append(search);
  const listBox = h('div');
  wrap.append(listBox);

  const renderSurahs = (q = '') => {
    listBox.innerHTML = '';
    SURAHS.filter((s) => !q || s.name.includes(q) || String(s.number).includes(q))
      .forEach((s) => {
        listBox.append(h('a', { class: 'prayer-row', href: `#/mushaf/${s.page}` },
          h('div', { class: 'prayer-row__icon', text: ar(s.number), style: 'font-weight:800;font-size:.82rem' }),
          h('div', { class: 'prayer-row__name' },
            h('div', { text: s.name }),
            h('div', { class: 'card__sub', text: `${s.type} · ${ar(s.ayahs)} آية` })),
          h('div', { class: 'prayer-row__time', text: `ص ${ar(s.page)}` })
        ));
      });
  };
  renderSurahs();
  search.addEventListener('input', () => renderSurahs(search.value.trim()));

  wrap.append(h('div', { class: 'section-title', text: 'الأجزاء' }));
  const juzGrid = h('div', { class: 'grid grid--three' });
  for (let j = 1; j <= 30; j++) {
    juzGrid.append(h('a', { class: 'pill', href: `#/mushaf/${juzStartPage(j)}`, style: 'min-height:52px;font-size:.85rem' },
      h('span', { text: `جزء ${ar(j)}` })));
  }
  wrap.append(juzGrid);
  return wrap;
}

function khatmahCard() {
  const st = khatmahStatus();
  const card = h('div', { class: 'card' });

  if (!st) {
    card.append(
      h('div', { class: 'card__head' },
        h('div', {}, h('div', { class: 'card__title', text: 'ابدأ ختمة' }),
          h('div', { class: 'card__sub', text: 'اختر عدد الأيام ونحسب لك ورد كل يوم' }))),
      h('div', { class: 'grid' },
        ...PRESETS.map((p) => h('button', {
          class: 'pill', style: '--tile:#2f9e8f;min-height:56px',
          onclick: () => { startKhatmah(p.days); toast(`بدأت ختمة في ${daysWord(p.days)}`); location.hash = '#/quran'; rerender(); }
        }, h('span', { text: p.label }), h('small', { text: p.hint })))
      ),
      h('button', {
        class: 'btn btn--ghost btn--block', style: 'margin-top:11px', text: 'عدد أيام مخصّص…',
        onclick: customKhatmahSheet
      })
    );
    return card;
  }

  const R = 46, circ = 2 * Math.PI * R;
  const pct = st.percent / 100;

  card.append(
    h('div', { class: 'card__head' },
      h('div', {},
        h('div', { class: 'card__title', text: st.completed ? 'تمّت الختمة ✓' : 'ختمتك الحالية' }),
        h('div', { class: 'card__sub',
          text: st.completed ? 'تقبّل الله منك' : `اليوم ${ar(st.dayNumber)} من ${ar(st.daysPlanned)}` })),
      h('button', { class: 'icon-btn', html: iconHTML('settings'), 'aria-label': 'خيارات', onclick: khatmahOptions })
    ),
    h('div', { class: 'khatmah-ring' },
      h('div', { class: 'ring', html:
        `<svg viewBox="0 0 104 104">
          <circle class="bg" cx="52" cy="52" r="${R}"/>
          <circle class="fg" cx="52" cy="52" r="${R}" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct)}"/>
        </svg><div class="ring__label">${ar(Math.round(st.percent))}٪</div>` }),
      h('div', { style: 'flex:1' },
        h('div', { class: 'stat-row' },
          h('div', { class: 'stat' }, h('b', { text: ar(st.todayRemaining) }), h('span', { text: 'ورد اليوم المتبقّي' })),
          h('div', { class: 'stat' }, h('b', { text: ar(st.daysLeft) }), h('span', { text: 'أيام متبقية' }))),
        h('div', { class: 'stat-row', style: 'margin-top:8px' },
          h('div', { class: 'stat' }, h('b', { text: ar(st.read) }), h('span', { text: 'صفحة مقروءة' })),
          h('div', { class: 'stat' }, h('b', { text: ar(st.remainingPages) }), h('span', { text: 'صفحة متبقية' }))))
    ),
    h('div', { class: 'notice', style: 'margin-top:14px',
      text: st.completed
        ? 'أتممت ختمة كاملة — نسأل الله أن يجعله شفيعًا لك.'
        : st.onTrack
          ? `أنت في الموعد${st.diff > 0 ? ` ومتقدّم بـ ${pagesWord(st.diff)}` : ''} · الانتهاء المتوقّع ${st.finishDate.toLocaleDateString('ar-EG')}`
          : `أنت متأخّر بـ ${pagesWord(Math.abs(st.diff))} — اقرأ اليوم ${pagesWord(st.perDayNow)} للحاق بالخطة.` }),
    h('div', { class: 'card__sub', style: 'margin-top:10px',
      text: `أنت الآن عند صفحة ${ar(st.khatmah.lastPage)} · ${st.currentSurah.name} · الجزء ${ar(st.currentJuz)}` }),
    h('div', { class: 'btn-row', style: 'margin-top:12px' },
      h('button', { class: 'btn btn--sm', html: iconHTML('plus') + '<span>صفحة</span>',
        onclick: () => { addPages(1); rerender(); } }),
      h('button', { class: 'btn btn--sm', text: `+ ${ar(st.perDayNow)} (ورد اليوم)`,
        onclick: () => { addPages(st.todayRemaining || st.perDayNow); toast('تم تسجيل ورد اليوم'); touchStreak(); rerender(); } }),
      h('button', { class: 'btn btn--sm', html: iconHTML('minus') + '<span>تراجع</span>',
        onclick: () => { addPages(-1); rerender(); } }),
      h('a', { class: 'btn btn--sm btn--primary', href: `#/mushaf/${st.currentPage}`,
        html: iconHTML('quran') + '<span>اقرأ الآن</span>' })
    )
  );
  return card;

  function khatmahOptions() {
    const box = h('div', {},
      h('div', { class: 'field' },
        h('label', { text: 'تعديل الصفحة الحالية' }),
        h('input', { type: 'number', min: '0', max: String(TOTAL_PAGES), value: String(st.khatmah.lastPage), id: 'kpage' })),
      h('button', {
        class: 'btn btn--primary btn--block', text: 'حفظ',
        onclick: () => {
          const v = parseInt(document.getElementById('kpage').value, 10);
          if (!Number.isNaN(v)) { markPage(v); toast('تم التحديث'); }
          document.querySelector('.sheet-backdrop')?.remove();
          rerender();
        }
      }),
      h('button', {
        class: 'btn btn--ghost btn--block', style: 'margin-top:9px', text: 'إنهاء الختمة وحذفها',
        onclick: () => {
          if (confirm('هل تريد إلغاء الختمة الحالية؟')) {
            cancelKhatmah();
            document.querySelector('.sheet-backdrop')?.remove();
            toast('أُلغيت الختمة');
            rerender();
          }
        }
      })
    );
    sheet('خيارات الختمة', box);
  }
}

function customKhatmahSheet() {
  const input = h('input', { type: 'number', min: '1', max: '365', value: '30', id: 'kdays' });
  const out = h('div', { class: 'notice' });
  const update = () => {
    const d = Math.max(1, Math.min(365, parseInt(input.value, 10) || 1));
    out.textContent = `ستقرأ ${pagesWord(pagesPerDay(d))} يوميًّا، أي نحو ${ar((pagesPerDay(d) / 20).toFixed(1))} جزء في اليوم.`;
  };
  input.addEventListener('input', update);
  const box = h('div', {},
    h('div', { class: 'field' }, h('label', { text: 'كم يومًا تريد لختم القرآن؟' }), input),
    out,
    h('button', {
      class: 'btn btn--primary btn--block', style: 'margin-top:12px', text: 'ابدأ الختمة',
      onclick: () => {
        const d = Math.max(1, Math.min(365, parseInt(input.value, 10) || 30));
        startKhatmah(d);
        document.querySelector('.sheet-backdrop')?.remove();
        toast(`بدأت ختمة في ${daysWord(d)}`);
        rerender();
      }
    })
  );
  update();
  sheet('ختمة مخصّصة', box);
}

/* ===========================================================
   المصحف
   =========================================================== */
export function viewMushaf(pageNum) {
  const page = Math.max(1, Math.min(TOTAL_PAGES, parseInt(pageNum, 10) || 1));
  const wrap = h('div', { class: 'screen' });
  const surah = pageToSurah(page);

  wrap.append(h('div', { class: 'subhead' },
    h('a', { class: 'icon-btn', href: '#/quran', 'aria-label': 'رجوع', html: iconHTML('back') }),
    h('div', { class: 'subhead__title' },
      h('b', { text: `صفحة ${ar(page)}` }),
      h('span', { text: `${surah.name} · الجزء ${ar(pageToJuz(page))}` })),
    h('button', { class: 'icon-btn', html: iconHTML('bookmark'), 'aria-label': 'حفظ الصفحة',
      onclick: () => {
        const bm = store.get('quranBookmarks', []);
        if (!bm.includes(page)) { bm.unshift(page); store.set('quranBookmarks', bm.slice(0, 30)); toast('حُفظت الصفحة'); }
        else toast('محفوظة مسبقًا');
      } })
  ));

  const body = h('div', { class: 'mushaf', text: 'جارٍ التحميل…' });
  wrap.append(body);

  const nav = h('div', { class: 'btn-row', style: 'justify-content:space-between' },
    h('a', { class: 'btn', href: `#/mushaf/${Math.max(1, page - 1)}`, text: '‹ السابقة' }),
    h('button', { class: 'btn btn--primary', text: 'سجّل في الختمة',
      onclick: () => { if (khatmahStatus()) { markPage(page); toast('سُجّلت في الختمة'); touchStreak(); } else toast('لا توجد ختمة نشطة'); } }),
    h('a', { class: 'btn', href: `#/mushaf/${Math.min(TOTAL_PAGES, page + 1)}`, text: 'التالية ›' })
  );
  wrap.append(nav);

  store.set('lastRead', { page, at: Date.now() });

  fetchPage(page).then((data) => {
    body.textContent = '';
    if (data.offline) body.append(h('div', { class: 'notice', text: 'نسخة محفوظة — أنت غير متصل.' }));
    let lastSurah = null;
    for (const a of data.ayahs) {
      if (a.surah !== lastSurah) {
        lastSurah = a.surah;
        body.append(h('div', { class: 'mushaf__surah', text: `سورة ${a.surahName}` }));
        if (a.number === 1 && a.surah !== 1 && a.surah !== 9) {
          body.append(h('div', { class: 'mushaf__basmalah', text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' }));
        }
      }
      const span = h('span', { class: 'ayah' },
        a.text + ' ',
        h('span', { class: 'ayah-num', text: `۝${ar(a.number)}` }), ' ');
      span.addEventListener('click', () => copyText(`${a.text} [${a.surahName}: ${a.number}]`));
      body.append(span);
    }
  }).catch((err) => {
    body.textContent = '';
    body.append(h('div', { class: 'notice notice--warn', text: err.message }),
      h('div', { style: 'font-family:var(--font);font-size:.9rem;line-height:2;text-align:start',
        text: 'يمكنك تحميل الصفحات مسبقًا من الإعدادات ← تحميل المصحف للقراءة دون إنترنت.' }));
  });

  return wrap;
}

/* ===========================================================
   البث المباشر
   =========================================================== */
export function viewLive() {
  const wrap = h('div', { class: 'screen' });
  wrap.append(subhead('البث المباشر', 'الحرم المكي والحرم النبوي'));

  const channels = [
    { id: 'makkah', name: 'مكة المكرمة — المسجد الحرام', yt: 'https://www.youtube.com/embed/live_stream?channel=UCDGSLnKDcIAA8Rifw1Luj7g' },
    { id: 'madinah', name: 'المدينة المنورة — المسجد النبوي', yt: 'https://www.youtube.com/embed/live_stream?channel=UCbEwXBSbAoWZ-a6-vRZBcHA' }
  ];

  const frame = h('div', { class: 'live-frame' });
  const setChannel = (ch) => {
    frame.innerHTML = '';
    frame.append(h('iframe', {
      src: ch.yt, title: ch.name, allow: 'autoplay; encrypted-media; picture-in-picture',
      allowfullscreen: true, loading: 'lazy',
      referrerpolicy: 'strict-origin-when-cross-origin'
    }));
  };

  wrap.append(h('div', { class: 'chip-row', style: 'margin-bottom:12px' },
    ...channels.map((ch, i) => h('button', {
      class: 'chip', text: ch.name.split(' — ')[0], 'aria-pressed': i === 0,
      onclick: (e) => {
        wrap.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        setChannel(ch);
      }
    }))
  ));
  wrap.append(frame);
  setChannel(channels[0]);

  wrap.append(h('div', { class: 'notice',
    text: 'يعتمد البث على قنوات يوتيوب الرسمية، ويحتاج اتصالًا بالإنترنت. إن لم يظهر البث فافتحه في تطبيق يوتيوب.' }));

  wrap.append(h('div', { class: 'section-title', text: 'إذاعات القرآن' }));
  const radios = [
    { name: 'إذاعة القرآن الكريم من مكة', url: 'https://stream.radiojar.com/0tpy1h0kxtzuv' },
    { name: 'إذاعة السنة النبوية', url: 'https://stream.radiojar.com/8s5u5tpdtwzuv' }
  ];
  const audio = h('audio', { controls: true, style: 'width:100%;margin-top:8px' });
  wrap.append(h('div', { class: 'chip-row' },
    ...radios.map((r) => h('button', {
      class: 'chip', text: r.name,
      onclick: () => { audio.src = r.url; audio.play().catch(() => toast('تعذّر تشغيل البث')); }
    }))
  ), audio);

  return wrap;
}

/* ===========================================================
   إحسان — التبرع
   =========================================================== */
export function viewDonate() {
  const wrap = h('div', { class: 'screen' });
  wrap.append(subhead('إحسان', 'منصّة وطنية للتبرّع والأعمال الخيرية'));

  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'dhikr__text', style: 'font-size:1rem',
      text: 'قال ﷺ: «ما نقصت صدقة من مال، وما زاد الله عبدًا بعفو إلا عزًّا، وما تواضع أحد لله إلا رفعه الله».' }),
    h('div', { class: 'dhikr__source', style: 'margin-top:10px', text: 'رواه مسلم ٢٥٨٨' })
  ));

  const links = [
    { name: 'منصة إحسان', desc: 'المنصة الوطنية للعمل الخيري — السعودية', url: 'https://ehsan.sa' },
    { name: 'صدقة جارية', desc: 'حفر آبار، بناء مساجد، كفالة أيتام', url: 'https://ehsan.sa/campaigns' },
    { name: 'إفطار صائم', desc: 'من فطّر صائمًا كان له مثل أجره', url: 'https://ehsan.sa' },
    { name: 'الجمعيات الخيرية المعتمدة', desc: 'المركز الوطني لتنمية القطاع غير الربحي', url: 'https://ncnp.gov.sa' }
  ];

  for (const l of links) {
    wrap.append(h('a', {
      class: 'prayer-row', href: l.url, target: '_blank', rel: 'noopener noreferrer'
    },
      h('div', { class: 'prayer-row__icon', html: iconHTML('gift') }),
      h('div', { class: 'prayer-row__name' },
        h('div', { text: l.name }),
        h('div', { class: 'card__sub', text: l.desc })),
      h('div', { class: 'prayer-row__time', html: iconHTML('chevron') })
    ));
  }

  wrap.append(h('div', { class: 'notice', style: 'margin-top:14px',
    text: 'التطبيق لا يستقبل أي تبرّع ولا يأخذ أي عمولة — الروابط تنقلك مباشرة إلى المنصّات الرسمية.' }));
  return wrap;
}

/* ===========================================================
   البحث
   =========================================================== */
export function viewSearch() {
  const wrap = h('div', { class: 'screen' });
  wrap.append(subhead('البحث', 'في الأذكار والأدعية والأحاديث وأسماء الله'));

  const input = h('input', { class: 'search-input', type: 'search', placeholder: 'اكتب كلمة للبحث…', autofocus: true });
  const results = h('div');
  wrap.append(input, results);

  const index = buildSearchIndex();

  const run = () => {
    const q = input.value.trim();
    results.innerHTML = '';
    if (q.length < 2) {
      results.append(h('div', { class: 'empty' }, h('p', { text: 'اكتب حرفين على الأقل للبحث.' })));
      return;
    }
    const norm = (s) => s.replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
    const nq = norm(q);
    const hits = index.filter((it) => norm(it.text).includes(nq) || norm(it.cat).includes(nq)).slice(0, 60);

    if (!hits.length) {
      results.append(h('div', { class: 'empty' }, h('p', { text: 'لا توجد نتائج مطابقة.' })));
      return;
    }
    results.append(h('div', { class: 'card__sub', style: 'margin-bottom:10px', text: `${ar(hits.length)} نتيجة` }));
    for (const it of hits) {
      const node = h('a', { class: 'result', href: it.href },
        h('div', { class: 'result__cat', text: it.cat }),
        h('div', { class: 'result__text',
          html: esc(it.text.slice(0, 220)).replace(new RegExp(esc(q), 'g'), (m) => `<mark>${m}</mark>`)
            + (it.text.length > 220 ? '…' : '') })
      );
      results.append(node);
    }
  };
  input.addEventListener('input', run);
  run();
  return wrap;
}

function buildSearchIndex() {
  const idx = [];
  for (const k of ADHKAR_ORDER) {
    ADHKAR[k].items.forEach((it, i) =>
      idx.push({ cat: ADHKAR[k].title, text: it.text, href: `#/list/adhkar/${k}` }));
  }
  for (const k of DUAS_ORDER) {
    DUAS[k].items.forEach((it) =>
      idx.push({ cat: DUAS[k].title, text: it.text, href: `#/list/duas/${k}` }));
  }
  for (const k of HADITH_ORDER) {
    HADITH_SECTIONS[k].items.forEach((it) =>
      idx.push({ cat: HADITH_SECTIONS[k].title, text: it.text, href: `#/hadith/${k}` }));
  }
  ASMA_HUSNA.forEach((n) => idx.push({ cat: 'أسماء الله الحسنى', text: `${n.name} — ${n.meaning}`, href: '#/names' }));
  SURAHS.forEach((s) => idx.push({ cat: 'سور القرآن', text: `سورة ${s.name} — ${s.type}`, href: `#/mushaf/${s.page}` }));
  return idx;
}

/* ===========================================================
   الإعدادات
   =========================================================== */
export function viewSettings() {
  const wrap = h('div', { class: 'screen' });
  wrap.append(subhead('الإعدادات', 'خصّص التطبيق كما تحب'));

  /* — المظهر — */
  wrap.append(h('div', { class: 'section-title', text: 'المظهر' }));
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'field' },
      h('label', { text: 'الوضع' }),
      h('div', { class: 'chip-row' },
        ...[['auto', 'تلقائي'], ['light', 'نهار'], ['dark', 'ليل']].map(([v, name]) =>
          h('button', {
            class: 'chip', text: name, 'aria-pressed': store.get('theme') === v,
            onclick: (e) => {
              store.set('theme', v);
              applyTheme();
              wrap.querySelectorAll('.chip').forEach((c) => { if (c.closest('.field') === e.currentTarget.closest('.field')) c.setAttribute('aria-pressed', 'false'); });
              e.currentTarget.setAttribute('aria-pressed', 'true');
            }
          }))
      )),
    h('div', { class: 'field' },
      h('label', { text: `حجم الخط: ${ar(Math.round(store.get('fontScale') * 100))}٪` }),
      h('input', {
        type: 'range', min: '0.85', max: '1.6', step: '0.05', value: String(store.get('fontScale')),
        oninput: (e) => {
          store.set('fontScale', parseFloat(e.target.value));
          document.documentElement.style.setProperty('--font-scale', e.target.value);
          e.target.closest('.field').querySelector('label').textContent =
            `حجم الخط: ${ar(Math.round(e.target.value * 100))}٪`;
        }
      })),
    switchRow('عرض الوقت بنظام ٢٤ ساعة', 'بدل ص/م', 'time24')
  ));

  /* — أيقونة التطبيق — */
  wrap.append(h('div', { class: 'section-title', text: 'أيقونة التطبيق' }));
  const iconGrid = h('div', { class: 'grid grid--three' });
  for (const [key, meta] of Object.entries(APP_ICONS)) {
    iconGrid.append(h('button', {
      class: 'pill', style: 'min-height:76px;flex-direction:column',
      'data-icon': key,
      onclick: () => {
        store.set('appIcon', key);
        applyAppIcon();
        iconGrid.querySelectorAll('.pill').forEach((p) => p.style.boxShadow = '');
        iconGrid.querySelector(`[data-icon="${key}"]`).style.boxShadow = 'var(--shadow-in)';
        toast('تم تغيير الأيقونة');
      }
    }, h('span', { text: meta.emoji, style: 'font-size:1.6rem' }), h('small', { text: meta.name })));
  }
  wrap.append(iconGrid);
  const cur = iconGrid.querySelector(`[data-icon="${store.get('appIcon')}"]`);
  if (cur) cur.style.boxShadow = 'var(--shadow-in)';

  /* — الموقع والمواقيت — */
  wrap.append(h('div', { class: 'section-title', text: 'الموقع ومواقيت الصلاة' }));
  const loc = store.get('location');
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'switch-row' },
      h('div', { class: 'switch-row__text' },
        h('b', { text: loc.city }),
        h('span', { text: `${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}` })),
      h('button', { class: 'btn btn--sm', text: 'تحديد تلقائي', onclick: autoLocate })
    ),
    h('div', { class: 'field', style: 'margin-top:12px' },
      h('label', { text: 'أو اختر مدينتك' }),
      selectEl(CITIES.map((c) => [c.city, c.city]), loc.city, (v) => {
        const c = CITIES.find((x) => x.city === v);
        if (c) { store.set('location', { lat: c.lat, lng: c.lng, city: c.city, tz: c.tz, auto: false }); toast('تم تغيير المدينة'); rerender(); }
      })),
    h('div', { class: 'field' },
      h('label', { text: 'طريقة الحساب' }),
      selectEl(Object.entries(METHODS).map(([k, m]) => [k, m.name]), store.get('method'),
        (v) => { store.set('method', v); toast('تم التحديث'); })),
    h('div', { class: 'field' },
      h('label', { text: 'مذهب العصر' }),
      selectEl(Object.entries(ASR_METHODS).map(([k, m]) => [k, m.name]), store.get('asrMethod'),
        (v) => { store.set('asrMethod', v); toast('تم التحديث'); })),
    h('div', { class: 'field' },
      h('label', { text: 'تعديل التاريخ الهجري (± أيام)' }),
      selectEl([[-2, '−٢'], [-1, '−١'], [0, '٠'], [1, '+١'], [2, '+٢']], String(store.get('hijriOffset')),
        (v) => { store.set('hijriOffset', parseInt(v, 10)); toast('تم التحديث'); rerender(); })),
    h('button', {
      class: 'btn btn--ghost btn--block', text: 'تعديل دقائق كل صلاة…',
      onclick: adjustmentsSheet
    })
  ));

  /* — التنبيهات — */
  wrap.append(h('div', { class: 'section-title', text: 'التنبيهات' }));
  const notifCard = h('div', { class: 'card' },
    switchRow('تفعيل التنبيهات', notify.permission() === 'granted' ? 'مسموح به' : 'يتطلّب إذن المتصفح', 'notifications.enabled',
      async (on) => {
        if (on) {
          const p = await notify.requestPermission();
          if (p !== 'granted') { store.set('notifications.enabled', false); toast('لم يُسمح بالتنبيهات'); rerender(); return; }
          notify.startScheduler();
          toast('فُعّلت التنبيهات');
        } else { notify.stopScheduler(); }
      }),
    switchRow('تنبيه قبل الأذان', 'تذكير قبل دخول الوقت', 'notifications.beforeAdhan'),
    h('div', { class: 'field', style: 'margin-top:10px' },
      h('label', { text: 'قبل الأذان بـ (دقائق)' }),
      selectEl([5, 10, 15, 20, 30].map((n) => [n, `${ar(n)} دقائق`]), String(store.get('notifications.beforeAdhanMinutes')),
        (v) => { store.set('notifications.beforeAdhanMinutes', parseInt(v, 10)); notify.scheduleAll(); toast('تم التحديث'); })),
    switchRow('تنبيه عند الأذان', 'عند دخول وقت كل صلاة', 'notifications.atAdhan'),
    switchRow('أذكار الصباح', 'تذكير يومي', 'notifications.morningAdhkar'),
    timeRow('وقت تذكير الصباح', 'notifications.morningAt'),
    switchRow('أذكار المساء', 'تذكير يومي', 'notifications.eveningAdhkar'),
    timeRow('وقت تذكير المساء', 'notifications.eveningAt'),
    switchRow('تذكير الورد اليومي من القرآن', 'لا تنسَ ختمتك', 'notifications.quranReminder'),
    timeRow('وقت تذكير الورد', 'notifications.quranAt'),
    switchRow('صوت التنبيه', 'إن دعمه الجهاز', 'notifications.sound'),
    h('button', { class: 'btn btn--ghost btn--block', style: 'margin-top:10px', text: 'تجربة التنبيه',
      onclick: async () => {
        const p = await notify.requestPermission();
        if (p !== 'granted') { toast('لم يُسمح بالتنبيهات'); return; }
        const ok = await notify.testNotification();
        toast(ok ? 'أُرسل تنبيه تجريبي' : 'تعذّر إرسال التنبيه');
      } })
  );
  wrap.append(notifCard);
  wrap.append(h('div', { class: 'notice',
    text: 'التنبيهات تعمل ما دام التطبيق مفتوحًا أو في الخلفية. لأفضل نتيجة أضف التطبيق إلى الشاشة الرئيسية واسمح له بالإشعارات.' }));

  /* — شريط الصيام — */
  wrap.append(h('div', { class: 'section-title', text: 'شريط الصيام' }));
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'field' },
      h('label', { text: 'ظهور الشريط العلوي' }),
      h('div', { class: 'chip-row' },
        ...[['auto', 'في رمضان فقط'], ['always', 'دائمًا'], ['off', 'إخفاء']].map(([v, name]) =>
          h('button', {
            class: 'chip', text: name, 'aria-pressed': store.get('fastingBar') === v,
            onclick: (e) => {
              store.set('fastingBar', v);
              e.currentTarget.closest('.chip-row').querySelectorAll('.chip')
                .forEach((c) => c.setAttribute('aria-pressed', 'false'));
              e.currentTarget.setAttribute('aria-pressed', 'true');
              document.dispatchEvent(new CustomEvent('fastingbar:refresh'));
            }
          }))),
      h('div', { class: 'field__hint',
        text: 'في وضع «رمضان فقط» يظهر الشريط طوال شهر رمضان ويختفي تلقائيًّا بانتهائه.' })
    )
  ));

  /* — القرآن دون إنترنت — */
  wrap.append(h('div', { class: 'section-title', text: 'المصحف دون إنترنت' }));
  const cacheInfo = h('div', { class: 'card__sub', text: `المحفوظ حاليًّا: ${ar(cachedPagesCount())} صفحة` });
  wrap.append(h('div', { class: 'card' },
    cacheInfo,
    h('div', { class: 'btn-row', style: 'margin-top:12px' },
      h('button', {
        class: 'btn btn--sm', text: 'تحميل ٣٠ صفحة من موضعي',
        onclick: async (e) => {
          const start = store.get('lastRead')?.page || 1;
          e.target.textContent = 'جارٍ التحميل…';
          const ok = await prefetchPages(start, 30, (i, total) => { e.target.textContent = `${ar(i)}/${ar(total)}`; });
          e.target.textContent = 'تحميل ٣٠ صفحة من موضعي';
          cacheInfo.textContent = `المحفوظ حاليًّا: ${ar(cachedPagesCount())} صفحة`;
          toast(`حُفظت ${pagesWord(ok)}`);
        }
      }),
      h('button', {
        class: 'btn btn--sm', text: 'مسح المحفوظ',
        onclick: () => { clearQuranCache(); cacheInfo.textContent = 'المحفوظ حاليًّا: ٠ صفحة'; toast('تم المسح'); }
      })
    )
  ));

  /* — البيانات — */
  wrap.append(h('div', { class: 'section-title', text: 'البيانات' }));
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'btn-row' },
      h('button', {
        class: 'btn btn--sm', html: iconHTML('download') + '<span>نسخة احتياطية</span>',
        onclick: () => {
          const blob = new Blob([store.export()], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: 'maa-allah-backup.json' });
          document.body.append(a); a.click(); a.remove();
          toast('تم تنزيل النسخة');
        }
      }),
      h('button', {
        class: 'btn btn--sm', text: 'استعادة نسخة',
        onclick: () => {
          const inp = h('input', { type: 'file', accept: 'application/json', style: 'display:none' });
          inp.addEventListener('change', async () => {
            const f = inp.files?.[0];
            if (!f) return;
            try { store.import(await f.text()); toast('تمت الاستعادة'); location.reload(); }
            catch { toast('ملف غير صالح'); }
          });
          document.body.append(inp); inp.click(); inp.remove();
        }
      }),
      h('button', {
        class: 'btn btn--sm', text: 'إعادة ضبط الكل',
        onclick: () => { if (confirm('سيُحذف كل شيء: الختمة والمفضلة والإعدادات. متأكد؟')) { store.reset(); location.reload(); } }
      })
    )
  ));

  wrap.append(h('div', { class: 'card', style: 'text-align:center;margin-top:18px' },
    h('div', { style: 'color:var(--accent);width:44px;margin:0 auto 8px', html: LOGO }),
    h('div', { class: 'card__title', text: 'مع الله' }),
    h('div', { class: 'card__sub', text: 'تطبيق إسلامي على منهج أهل السنة والجماعة' }),
    h('div', { class: 'card__sub', style: 'margin-top:8px',
      text: 'كل النصوص موثّقة من الكتاب والسنة الصحيحة ومصادرها مذكورة مع كل نص.' }),
    h('div', { class: 'card__sub', style: 'margin-top:8px', text: `النسخة ${ar(1)}.${ar(0)}.${ar(0)}` })
  ));

  return wrap;

  function switchRow(title, desc, path, onChange) {
    const sw = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!store.get(path)) });
    sw.addEventListener('click', async () => {
      const on = !store.get(path);
      store.set(path, on);
      sw.setAttribute('aria-checked', String(on));
      await onChange?.(on);
      notify.scheduleAll();
    });
    return h('div', { class: 'switch-row' },
      h('div', { class: 'switch-row__text' }, h('b', { text: title }), h('span', { text: desc })), sw);
  }

  function timeRow(title, path) {
    return h('div', { class: 'switch-row' },
      h('div', { class: 'switch-row__text' }, h('b', { text: title })),
      h('input', {
        type: 'time', value: store.get(path),
        style: 'width:auto;padding:8px 12px;border-radius:12px;background:var(--bg-2);border:1px solid var(--line)',
        onchange: (e) => { store.set(path, e.target.value); notify.scheduleAll(); toast('تم التحديث'); }
      }));
  }

  function selectEl(options, value, onChange) {
    const sel = h('select', { onchange: (e) => onChange(e.target.value) });
    for (const [v, label] of options) {
      sel.append(h('option', { value: String(v), selected: String(v) === String(value) }, label));
    }
    return sel;
  }

  async function autoLocate() {
    toast('جارٍ تحديد الموقع…');
    try {
      const pos = await getCurrentPosition();
      store.set('location', { ...pos, city: 'موقعي الحالي', tz: deviceTimeZone(), auto: true });
      toast('تم تحديد الموقع');
      rerender();
    } catch (e) { toast(e.message); }
  }

  function adjustmentsSheet() {
    const adj = store.get('adjustments');
    const box = h('div', {});
    for (const meta of PRAYER_META) {
      box.append(h('div', { class: 'switch-row' },
        h('div', { class: 'switch-row__text' }, h('b', { text: meta.name })),
        h('input', {
          type: 'number', min: '-30', max: '30', value: String(adj[meta.key] || 0),
          style: 'width:88px;padding:8px;border-radius:12px;background:var(--bg-2);border:1px solid var(--line);text-align:center',
          onchange: (e) => { adj[meta.key] = parseInt(e.target.value, 10) || 0; store.set('adjustments', adj); }
        })));
    }
    box.append(h('div', { class: 'field__hint', style: 'margin-top:10px',
      text: 'القيم بالدقائق، تُضاف أو تُطرح من الوقت المحسوب لمطابقة تقويم مسجدك.' }));
    sheet('تعديل المواقيت', box);
  }
}

/* إعادة رسم الشاشة الحالية */
function rerender() {
  document.dispatchEvent(new CustomEvent('app:rerender'));
}

export function applyTheme() {
  const pref = store.get('theme', 'auto');
  const dark = pref === 'dark' ||
    (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#171b16' : '#ecedeb');
}

export function applyAppIcon() {
  const key = store.get('appIcon', 'star');
  const meta = APP_ICONS[key] || APP_ICONS.star;
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="22" fill="#faf8f2"/>
    <text x="50" y="50" font-size="54" text-anchor="middle" dominant-baseline="central">${meta.emoji}</text>
  </svg>`;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.append(link); }
  link.type = 'image/svg+xml';
  link.href = 'data:image/svg+xml,' + encodeURIComponent(svgIcon);
}
