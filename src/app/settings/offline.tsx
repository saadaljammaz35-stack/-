// «التنزيل للاستخدام دون إنترنت»: everything that normally comes from the network — the current
// reciter's recitations, the large hadith collections and the chosen translation — saved in one go.
import { BookOpen, CircleCheck, Download, Headphones, Languages, Square } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, EmptyState, ProgressBar, Txt } from '@/components/ui';
import { cachedTranslationPages, getPageTranslation, RECITERS, TRANSLATIONS } from '@/data/remote';
import { downloadedSurahs, downloadsSupported, downloadSurah, useDownloads } from '@/features/audio/downloads';
import { BOOKS, installBook, installedBooks } from '@/features/hadith/books';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const PAGES = 604;
const SURAHS = 114;
const REMOTE_BOOKS = BOOKS.filter((b) => !b.bundled);

type Part = 'audio' | 'books' | 'translation';
type Status = { audio: number; books: number; translation: number };

export default function Offline() {
  const t = useTheme();
  const { tr } = useI18n();
  const reciterId = useSettings((s) => s.reciterId);
  const translationId = useSettings((s) => s.translationId);
  const version = useDownloads((s) => s.version);
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState<Part | null>(null);
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(0);
  const cancelled = useRef(false);

  const reciter = RECITERS.find((r) => r.id === reciterId) ?? RECITERS[0];
  const translation = TRANSLATIONS.find((x) => x.id === translationId) ?? TRANSLATIONS[0];

  const refresh = useCallback(
    () =>
      Promise.all([installedBooks(), cachedTranslationPages(translationId)])
        .then(([books, pages]): Status => {
          const ids = new Set(books.map((b) => b.id));
          return { audio: downloadedSurahs(reciterId).length, books: REMOTE_BOOKS.filter((b) => ids.has(b.id)).length, translation: Math.min(PAGES, pages) };
        })
        .then(setStatus),
    [reciterId, translationId],
  );

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  const run = async (parts: Part[]) => {
    cancelled.current = false;
    setFailed(0);
    for (const part of parts) {
      if (cancelled.current) break;
      setRunning(part);
      setStep(0);
      if (part === 'audio') {
        const have = new Set(downloadedSurahs(reciterId));
        for (let n = 1; n <= SURAHS && !cancelled.current; n++) {
          setStep(n);
          if (have.has(n)) continue;
          await downloadSurah(reciterId, n).catch(() => setFailed((f) => f + 1));
        }
      } else if (part === 'books') {
        const have = new Set((await installedBooks()).map((b) => b.id));
        for (let i = 0; i < REMOTE_BOOKS.length && !cancelled.current; i++) {
          setStep(i + 1);
          if (have.has(REMOTE_BOOKS[i].id)) continue;
          await installBook(REMOTE_BOOKS[i].id).catch(() => setFailed((f) => f + 1));
        }
      } else {
        for (let page = 1; page <= PAGES && !cancelled.current; page++) {
          if (page % 4 === 0 || page === PAGES) setStep(page);
          await getPageTranslation(translationId, page).catch(() => setFailed((f) => f + 1));
        }
      }
      await refresh();
    }
    setRunning(null);
  };

  if (!downloadsSupported) {
    return (
      <Screen title={tr('التنزيل دون إنترنت', 'Offline downloads')}>
        <EmptyState icon={Download} title={tr('متاح في تطبيق الجوال', 'Available in the mobile app')} message={tr('نسخة المتصفح لا تحفظ التلاوات والكتب على الجهاز.', 'The web version cannot save recitations and books on the device.')} />
      </Screen>
    );
  }

  const parts: { id: Part; icon: typeof Download; title: string; subtitle: string; done: number; total: number; note: string }[] = [
    {
      id: 'audio',
      icon: Headphones,
      title: tr('تلاوة المصحف كاملًا', 'The whole Quran recited'),
      subtitle: reciter.name,
      done: status?.audio ?? 0,
      total: SURAHS,
      note: tr('مئات الميغابايت، فيُفضّل شبكة واي فاي.', 'Hundreds of megabytes — Wi-Fi is best.'),
    },
    {
      id: 'books',
      icon: BookOpen,
      title: tr('كتب السنة', 'Hadith collections'),
      subtitle: REMOTE_BOOKS.map((b) => b.name).join('، '),
      done: status?.books ?? 0,
      total: REMOTE_BOOKS.length,
      note: tr('يُتحقق من سلامة كل كتاب قبل حفظه.', 'Each book is verified before it is saved.'),
    },
    {
      id: 'translation',
      icon: Languages,
      title: tr('ترجمة معاني القرآن', 'Translation of the meanings'),
      subtitle: `${translation.name} — ${translation.language}`,
      done: status?.translation ?? 0,
      total: PAGES,
      note: tr('تُغيَّر الترجمة من إعدادات المصحف.', 'Change the translation in the mushaf settings.'),
    },
  ];

  const allDone = status != null && parts.every((p) => p.done >= p.total);
  const unit = (id: Part) => (id === 'audio' ? tr('سورة', 'surahs') : id === 'books' ? tr('كتب', 'books') : tr('صفحة', 'pages'));

  return (
    <Screen title={tr('التنزيل دون إنترنت', 'Offline downloads')}>
      <Txt muted style={{ lineHeight: 22 }}>
        {tr('المصحف والأذكار وموسوعة الأحاديث وأوقات الصلاة تعمل دون إنترنت أصلًا. ومن هنا تنزّل ما بقي ليعمل التطبيق كله في السفر وحيث لا شبكة.', 'The mushaf, adhkar, hadith encyclopedia and prayer times already work offline. Download the rest here so the whole app works when travelling or without a network.')}
      </Txt>
      {parts.map((p) => {
        const active = running === p.id;
        const complete = p.done >= p.total;
        return (
          <Card key={p.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <p.icon size={22} color={t.colors.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt weight="semibold">{p.title}</Txt>
                <Txt variant="caption" muted numberOfLines={2}>
                  {p.subtitle}
                </Txt>
              </View>
              {complete ? <CircleCheck size={22} color={t.colors.success} /> : null}
            </View>
            <ProgressBar value={active ? step / p.total : p.done / p.total} />
            <Txt variant="caption" muted>
              {active ? tr(`جارٍ التنزيل: ${step} من ${p.total}`, `Downloading ${step} of ${p.total}`) : `${p.done} / ${p.total} ${unit(p.id)} — ${p.note}`}
            </Txt>
            {!complete && !running ? <Button title={tr('تنزيل', 'Download')} icon={Download} tone="soft" onPress={() => run([p.id])} /> : null}
          </Card>
        );
      })}
      {running ? (
        <Button
          title={tr('إيقاف التنزيل', 'Stop downloading')}
          icon={Square}
          tone="danger"
          onPress={() => {
            cancelled.current = true;
          }}
        />
      ) : allDone ? (
        <Card tone="soft">
          <Txt weight="semibold" color={t.colors.primaryDeep} center>
            {tr('كل شيء محفوظ على جهازك.', 'Everything is saved on your device.')}
          </Txt>
        </Card>
      ) : (
        <Button title={tr('تنزيل الكل', 'Download everything')} icon={Download} disabled={!status} onPress={() => run(['books', 'translation', 'audio'])} />
      )}
      {failed > 0 ? (
        <Txt variant="caption" color={t.colors.danger} center>
          {tr(`تعذّر تنزيل ${failed} عنصرًا. تحقق من الاتصال ثم أعد المحاولة؛ يُكمل التنزيل من حيث توقف.`, `${failed} items failed. Check your connection and try again; it resumes where it stopped.`)}
        </Txt>
      ) : null}
    </Screen>
  );
}
