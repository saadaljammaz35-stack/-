import { router } from 'expo-router';
import { BookOpen, CircleCheck, Download, Heart, Library, Search, Trash } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { confirmAsync, showMessage } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Card, Group, IconButton, ProgressBar, Row, Txt } from '@/components/ui';
import { BOOKS, installBook, installedBooks, IntegrityError, removeBook, type InstalledBook } from '@/features/hadith/books';
import { useI18n } from '@/i18n';
import { useHadithStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function HadithHome() {
  const t = useTheme();
  const { tr } = useI18n();
  const [installed, setInstalled] = useState<InstalledBook[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const favorites = useHadithStore((s) => s.favorites);

  const refresh = useCallback(() => installedBooks().then(setInstalled), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const install = async (id: string) => {
    setProgress((p) => ({ ...p, [id]: 0 }));
    try {
      await installBook(id, (v) => setProgress((p) => ({ ...p, [id]: v })));
    } catch (err) {
      showMessage(
        tr('تعذر تحميل الكتاب', 'Download failed'),
        err instanceof IntegrityError
          ? tr('فشل التحقق من سلامة البيانات، فلم يُحفظ الكتاب. حاول لاحقًا.', 'The data failed verification and was not saved.')
          : tr('تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.', 'Check your connection and try again.'),
      );
    } finally {
      setProgress((p) => {
        const c = { ...p };
        delete c[id];
        return c;
      });
      refresh();
    }
  };

  const ids = new Set(installed.map((b) => b.id));
  return (
    <Screen title={tr('الأحاديث النبوية', 'Hadith')} actions={[{ icon: Search, label: tr('البحث', 'Search'), onPress: () => router.push('/hadith/search') }]}>
      <Card tone="primary" onPress={() => router.push('/hadith/enc')} style={{ gap: 6 }}>
        <Library size={26} color={t.colors.highlight} />
        <Txt variant="subheading" weight="bold" color="#fff">
          {tr('موسوعة الأحاديث النبوية المشروحة', 'Explained hadith encyclopedia')}
        </Txt>
        <Txt variant="caption" color="rgba(255,255,255,0.85)">
          {tr('أكثر من 3500 حديث مع الدرجة والشرح والفوائد — HadeethEnc.com — تعمل دون إنترنت', '3,500+ hadiths with grade, explanation and benefits — offline')}
        </Txt>
      </Card>

      <Txt weight="semibold">{tr('كتب السنة', 'Hadith collections')}</Txt>
      <Group>
        {BOOKS.map((b) => {
          const p = progress[b.id];
          const has = ids.has(b.id);
          return (
            <Row
              key={b.id}
              icon={BookOpen}
              title={b.name}
              subtitle={p != null ? undefined : has ? tr(`${b.count.toLocaleString('en')} حديث — متاح دون إنترنت`, `${b.count} hadiths — offline`) : tr(`${b.count.toLocaleString('en')} حديث — ${(b.bytes / 1e6).toFixed(1)} م.ب للتحميل`, `${b.count} hadiths — ${(b.bytes / 1e6).toFixed(1)} MB`)}
              onPress={has ? () => router.push({ pathname: '/hadith/book/[id]', params: { id: b.id } }) : undefined}
              chevron={has}
              right={
                p != null ? (
                  <View style={{ width: 90, gap: 4 }}>
                    <ProgressBar value={p} />
                    <ActivityIndicator size="small" color={t.colors.primary} />
                  </View>
                ) : has ? (
                  b.bundled ? (
                    <CircleCheck size={20} color={t.colors.success} />
                  ) : (
                    <IconButton
                      icon={Trash}
                      label={tr('حذف', 'Remove')}
                      tone="plain"
                      size={34}
                      onPress={() =>
                        confirmAsync(tr('حذف الكتاب من الجهاز؟', 'Remove from device?'), b.name, tr('حذف', 'Remove'), tr('إلغاء', 'Cancel')).then((ok) => {
                          if (ok) removeBook(b.id).then(refresh);
                        })
                      }
                    />
                  )
                ) : (
                  <IconButton icon={Download} label={tr('تحميل', 'Download')} size={38} onPress={() => install(b.id)} />
                )
              }
            />
          );
        })}
      </Group>
      <Txt variant="caption" muted>
        {tr(
          'تُحمَّل الكتب مرة واحدة من نسخة مثبّتة من قاعدة «hadith-api» المفتوحة، ويُتحقق من بصمة الملف (SHA-256) ومن ترقيم أحاديث مرجعية قبل حفظها. الترقيم: البخاري وفق فتح الباري، ومسلم وفق محمد فؤاد عبد الباقي. مسند أحمد غير مدرج لعدم توفر نسخة مفتوحة كاملة موثقة الترقيم.',
          'Books download once from a pinned copy of the open hadith-api dataset and are verified (SHA-256 and reference numbering) before saving. Musnad Ahmad is not included: no complete open edition with verified numbering is available.',
        )}
      </Txt>
      <Group>
        <Row icon={Heart} title={tr('الأحاديث المفضلة', 'Favourite hadiths')} subtitle={tr(`${favorites.length} حديثًا`, `${favorites.length}`)} onPress={() => router.push('/saved')} />
        <Row icon={Search} title={tr('البحث في الأحاديث', 'Search hadiths')} onPress={() => router.push('/hadith/search')} />
      </Group>
    </Screen>
  );
}
