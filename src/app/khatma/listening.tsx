// «ختمة السماع»: a khatma by listening, kept apart from the reading khatma. A verse counts once
// the reciter has finished it and moved on.
import { Check, Headphones, Play, RotateCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { confirmAsync } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Button, Card, ProgressBar, Tap, Txt } from '@/components/ui';
import { getSurahs, type Surah } from '@/data/content';
import { usePlayer } from '@/features/audio/player';
import { useI18n } from '@/i18n';
import { firstUnheard, heardBetween, heardCount, TOTAL_VERSES } from '@/lib/listening';
import { useListenStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function ListeningKhatma() {
  const t = useTheme();
  const { tr } = useI18n();
  const player = usePlayer();
  const { heard, completed, finish, reset } = useListenStore();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);

  const starts: number[] = [];
  surahs.reduce((id, s) => (starts.push(id), id + s.versesCount), 0);
  const count = heardCount(heard);
  const next = firstUnheard(heard);
  const nextSurah = next == null || !surahs.length ? null : surahs.findIndex((_, i) => (starts[i + 1] ?? TOTAL_VERSES) > next);
  const done = next == null;

  const playFrom = (surahIndex: number) => {
    const s = surahs[surahIndex];
    const from = starts[surahIndex];
    const to = from + s.versesCount - 1;
    let ayah = 1;
    for (let id = from; id <= to; id++) {
      if (heardBetween(heard, id, id) === 0) {
        ayah = id - from + 1;
        break;
      }
    }
    player.playSurah(s.id, ayah);
  };

  return (
    <Screen title={tr('ختمة السماع', 'Listening khatma')} subtitle={tr('مستقلة عن ختمة القراءة', 'Separate from your reading khatma')}>
      <Card tone="primary" style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Headphones size={24} color={t.colors.highlight} />
          <Txt variant="subheading" color="#FFFFFF" style={{ flex: 1 }}>
            {done ? tr('أتممت ختمة السماع، بارك الله فيك', 'Listening khatma complete') : tr(`سمعت ${count} آية من ${TOTAL_VERSES}`, `${count} of ${TOTAL_VERSES} verses heard`)}
          </Txt>
        </View>
        <ProgressBar value={count / TOTAL_VERSES} height={10} color={t.colors.highlight} />
        <Txt variant="caption" color="rgba(255,255,255,0.85)">
          {tr(`${Math.floor((count / TOTAL_VERSES) * 1000) / 10}%${completed.length ? ` · ختمات سابقة: ${completed.length}` : ''}`, `${Math.floor((count / TOTAL_VERSES) * 1000) / 10}%${completed.length ? ` · completed before: ${completed.length}` : ''}`)}
        </Txt>
        {done ? (
          <Button title={tr('ابدأ ختمة سماع جديدة', 'Start a new listening khatma')} icon={RotateCcw} tone="soft" onPress={finish} />
        ) : nextSurah != null && surahs[nextSurah] ? (
          <Button title={tr(`تابع الاستماع: سورة ${surahs[nextSurah].name}`, `Continue: ${surahs[nextSurah].nameSimple}`)} icon={Play} tone="soft" onPress={() => playFrom(nextSurah)} />
        ) : null}
      </Card>

      <Card padded={false}>
        {surahs.map((s, i) => {
          const from = starts[i];
          const n = heardBetween(heard, from, from + s.versesCount - 1);
          const full = n === s.versesCount;
          return (
            <Tap key={s.id} onPress={() => playFrom(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: full ? t.colors.primary : t.colors.surfaceAlt }}>
                {full ? <Check size={15} color="#FFFFFF" /> : <Txt variant="label">{s.id}</Txt>}
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt weight="medium">{tr(`سورة ${s.name}`, s.nameSimple)}</Txt>
                  <Txt variant="caption" muted>{`${n}/${s.versesCount}`}</Txt>
                </View>
                {n && !full ? <ProgressBar value={n / s.versesCount} height={4} /> : null}
              </View>
            </Tap>
          );
        })}
      </Card>
      <Txt variant="caption" muted center>
        {tr('تُحسب الآية إذا أتمّها القارئ وانتقل إلى ما بعدها، بأي قارئ وفي أي وقت.', 'A verse counts once the reciter finishes it and moves on, with any reciter, at any time.')}
      </Txt>
      {count && !done ? (
        <Button
          title={tr('البدء من جديد', 'Start over')}
          icon={RotateCcw}
          tone="plain"
          onPress={() => confirmAsync(tr('البدء من جديد؟', 'Start over?'), tr('سيُمسح تقدّم ختمة السماع الحالية.', 'This clears the current listening progress.'), tr('ابدأ من جديد', 'Start over'), tr('إلغاء', 'Cancel')).then((ok) => ok && reset())}
        />
      ) : null}
    </Screen>
  );
}
