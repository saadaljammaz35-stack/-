// Downloads the Arabic edition of «موسوعة الأحاديث النبوية» (HadeethEnc.com): each hadith
// with its attribution, grade, explanation, benefits and references. Terms of use: the
// content is shown without modification and attributed to HadeethEnc.com.
import { assert, fetchJson, log, mapLimit, writeJson } from './lib.mjs';

const API = 'https://hadeethenc.com/api/v1';

async function main() {
  const categories = await fetchJson(`${API}/categories/list/?language=ar`);
  log('categories', categories.length);
  const roots = categories.filter((c) => !c.parent_id);

  const ids = new Map();
  for (const root of roots) {
    let page = 1;
    for (;;) {
      const body = await fetchJson(
        `${API}/hadeeths/list/?language=ar&category_id=${root.id}&page=${page}&per_page=100`,
      );
      for (const h of body.data) if (!ids.has(h.id)) ids.set(h.id, root.id);
      if (Number(body.meta.current_page) >= Number(body.meta.last_page)) break;
      page++;
    }
  }
  log('unique hadiths', ids.size);

  const hadiths = (
    await mapLimit([...ids.keys()], 4, async (id) => {
      try {
        const h = await fetchJson(`${API}/hadeeths/one/?language=ar&id=${id}`);
        return {
          id: Number(h.id),
          title: h.title,
          text: h.hadeeth,
          attribution: h.attribution,
          grade: h.grade,
          explanation: h.explanation,
          hints: h.hints ?? [],
          meanings: (h.words_meanings ?? []).map((m) => ({ word: m.word, meaning: m.meaning })),
          reference: h.reference ?? '',
          categories: (h.categories ?? []).map(Number),
        };
      } catch (err) {
        log('failed', id, err.message);
        return null;
      }
    })
  ).filter(Boolean);
  assert(hadiths.length >= ids.size * 0.98, 'too many HadeethEnc downloads failed');
  assert(hadiths.every((h) => h.text && h.grade && h.attribution), 'incomplete HadeethEnc record');
  hadiths.sort((a, b) => a.id - b.id);

  const r = writeJson('hadith/hadeethenc.json', {
    source: 'https://hadeethenc.com',
    license: 'يُنقل المحتوى دون تعديل مع العزو إلى موسوعة الأحاديث النبوية HadeethEnc.com',
    categories: categories.map((c) => ({
      id: Number(c.id),
      title: c.title,
      parent: c.parent_id ? Number(c.parent_id) : null,
    })),
    hadiths,
  });
  log(r.file, r.bytes, 'hadiths', hadiths.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
