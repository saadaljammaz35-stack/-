import { router } from 'expo-router';
import { Gauge, Minus, Pause, Play, Plus, Repeat, SkipBack, SkipForward, Square } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { StarMark } from '@/components/brand';
import { Screen } from '@/components/screen';
import { Button, Card, Chip, EmptyState, IconButton, ProgressBar, Segmented, Txt } from '@/components/ui';
import { getSurahs, type Surah } from '@/data/content';
import { usePlayer, usePlayerProgress, type RepeatMode } from '@/features/audio/player';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function PlayerScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const p = usePlayer();
  const { position, duration } = usePlayerProgress();
  const rate = useSettings((s) => s.playbackRate);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [mode, setMode] = useState<RepeatMode['kind']>(p.repeat.kind);
  const [times, setTimes] = useState(p.repeat.kind === 'off' ? 3 : p.repeat.times);
  const [range, setRange] = useState(p.repeat.kind === 'range' ? { from: p.repeat.from, to: p.repeat.to } : { from: 1, to: 5 });

  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);

  if (!p.now) {
    return (
      <Screen title={tr('المشغّل', 'Player')}>
        <EmptyState icon={Play} title={tr('لا يوجد تشغيل حاليًا', 'Nothing playing')} action={tr('اختر سورة', 'Choose a surah')} onAction={() => router.replace('/quran/reciters')} />
      </Screen>
    );
  }
  const quran = p.now.kind === 'quran' ? p.now : null;
  const surah = quran ? surahs[quran.surah - 1] : null;
  const apply = (kind: RepeatMode['kind'], n = times, r = range) => {
    setMode(kind);
    if (kind === 'off') p.setRepeat({ kind: 'off' });
    else if (kind === 'ayah') p.setRepeat({ kind: 'ayah', times: n });
    else p.setRepeat({ kind: 'range', from: Math.min(r.from, r.to), to: Math.max(r.from, r.to), times: n });
  };
  const maxAyah = surah?.versesCount ?? 1;

  return (
    <Screen title={tr('المشغّل', 'Player')}>
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
        <StarMark size={96} />
        <Txt variant="title" center>
          {quran ? `سورة ${quran.surahName}` : p.now && p.now.kind !== 'quran' ? p.now.title : ''}
        </Txt>
        <Txt muted center>
          {quran ? `${quran.reciterName}${quran.ayah ? ` — ${tr('الآية', 'Ayah')} ${quran.ayah}` : ''}${quran.offline ? ` • ${tr('دون إنترنت', 'offline')}` : ''}` : p.now.kind === 'stream' ? p.now.subtitle : ''}
        </Txt>
        {duration > 0 ? (
          <View style={{ alignSelf: 'stretch', gap: 4, marginTop: 8 }}>
            <ProgressBar value={position / duration} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="label" muted>
                {fmt(position)}
              </Txt>
              <Txt variant="label" muted>
                {fmt(duration)}
              </Txt>
            </View>
          </View>
        ) : null}
        {p.error ? (
          <Txt color={t.colors.danger} center>
            {tr('تعذر التشغيل. تحقق من الاتصال أو حمّل السورة للاستماع دون إنترنت.', 'Playback failed. Check your connection or download the surah.')}
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 6 }}>
          {quran ? <IconButton icon={SkipForward} label={tr('الآية السابقة', 'Previous ayah')} onPress={() => p.stepAyah(-1)} size={52} /> : null}
          <Pressable onPress={p.toggle} accessibilityLabel={p.playing ? tr('إيقاف مؤقت', 'Pause') : tr('تشغيل', 'Play')} style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: t.colors.fill, alignItems: 'center', justifyContent: 'center' }}>
            {p.playing ? <Pause size={32} color="#fff" fill="#fff" /> : <Play size={32} color="#fff" fill="#fff" />}
          </Pressable>
          {quran ? <IconButton icon={SkipBack} label={tr('الآية التالية', 'Next ayah')} onPress={() => p.stepAyah(1)} size={52} /> : null}
        </View>
        <Button title={tr('إيقاف', 'Stop')} icon={Square} tone="plain" onPress={() => (p.stop(), router.back())} />
      </Card>

      {quran ? (
        <>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Repeat size={18} color={t.colors.primaryDeep} />
              <Txt weight="semibold">{tr('التكرار للحفظ', 'Repeat for memorisation')}</Txt>
            </View>
            <Segmented<RepeatMode['kind']>
              value={mode}
              onChange={(k) => apply(k)}
              options={[
                { value: 'off', label: tr('بدون', 'Off') },
                { value: 'ayah', label: tr('تكرار الآية', 'Ayah') },
                { value: 'range', label: tr('نطاق آيات', 'Range') },
              ]}
            />
            {mode !== 'off' ? (
              <View style={{ gap: 10 }}>
                <Txt variant="caption" muted>
                  {tr('عدد مرات التكرار', 'Repetitions')}
                </Txt>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {[2, 3, 5, 7, 10, 20].map((n) => (
                    <Chip key={n} label={`${n}×`} active={times === n} onPress={() => (setTimes(n), apply(mode, n))} />
                  ))}
                </View>
              </View>
            ) : null}
            {mode === 'range' ? (
              <View style={{ gap: 8 }}>
                {(['from', 'to'] as const).map((edge) => (
                  <View key={edge} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Txt style={{ width: 70 }}>{edge === 'from' ? tr('من آية', 'From') : tr('إلى آية', 'To')}</Txt>
                    <IconButton icon={Minus} label={tr('إنقاص', 'Decrease')} size={34} onPress={() => { const r = { ...range, [edge]: Math.max(1, range[edge] - 1) }; setRange(r); apply('range', times, r); }} />
                    <Txt weight="bold" style={{ minWidth: 40, textAlign: 'center' }}>
                      {range[edge]}
                    </Txt>
                    <IconButton icon={Plus} label={tr('زيادة', 'Increase')} size={34} onPress={() => { const r = { ...range, [edge]: Math.min(maxAyah, range[edge] + 1) }; setRange(r); apply('range', times, r); }} />
                  </View>
                ))}
                <Button title={tr('ابدأ من أول النطاق', 'Start the range')} tone="soft" onPress={() => p.seekAyah(Math.min(range.from, range.to))} />
              </View>
            ) : null}
          </Card>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Gauge size={18} color={t.colors.primaryDeep} />
              <Txt weight="semibold">{tr('سرعة التلاوة', 'Speed')}</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                <Chip key={r} label={`${r}×`} active={rate === r} onPress={() => p.setRate(r)} />
              ))}
            </View>
          </Card>
          <Button title={tr('تغيير القارئ أو تحميل السور', 'Change reciter or download')} tone="soft" onPress={() => router.push('/quran/reciters')} />
        </>
      ) : null}
    </Screen>
  );
}
