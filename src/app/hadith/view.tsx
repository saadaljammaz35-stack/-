import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Screen } from '@/components/screen';
import { EmptyState, Loading, Txt } from '@/components/ui';
import { bookName, getHadith, type Hadith } from '@/features/hadith/books';
import { HadithCard } from '@/features/hadith/hadith-card';
import { useI18n } from '@/i18n';
import { ScrollText } from 'lucide-react-native';

export default function HadithView() {
  const { tr } = useI18n();
  const { book, n } = useLocalSearchParams<{ book: string; n: string }>();
  const [h, setH] = useState<Hadith | null | undefined>(undefined);
  useEffect(() => {
    getHadith(book, Number(n)).then(setH);
  }, [book, n]);
  return (
    <Screen title={bookName(book)} subtitle={h ? tr(`رقم ${h.display}`, `No. ${h.display}`) : undefined}>
      {h === undefined ? (
        <Loading />
      ) : h === null ? (
        <EmptyState icon={ScrollText} title={tr('الحديث غير متاح', 'Not available')} message={tr('حمّل الكتاب من قسم الأحاديث أولًا.', 'Download the book from the Hadith section first.')} />
      ) : (
        <>
          <HadithCard h={h} />
          {h.grades.length ? (
            <Txt variant="caption" muted>
              {tr('أحكام العلماء منقولة كما وردت في مصدر البيانات دون تعديل.', 'Gradings are shown exactly as published in the dataset.')}
            </Txt>
          ) : null}
        </>
      )}
    </Screen>
  );
}
