// «قارن بين القراء»: one verse in every reciter's voice, one after another or each on its own,
// to choose the voice to read and memorise with.
import { useLocalSearchParams } from 'expo-router';
import { CircleCheck, ListMusic, Play, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, IconButton, QuranText, Tap, Txt } from '@/components/ui';
import { getSurahs, getVerseByKey, type Surah, type Verse } from '@/data/content';
import { RECITERS } from '@/data/remote';
import { usePlayer } from '@/features/audio/player';
import { useVerseClip } from '@/features/audio/verse-clip';
import { VersePicker, type VerseRef } from '@/features/quran/verse-picker';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

export default function CompareReciters() {
  const t = useTheme();
  const { tr } = useI18n();
  const params = useLocalSearchParams<{ surah?: string; ayah?: string }>();
  const reciterId = useSettings((s) => s.reciterId);
  const set = useSettings((s) => s.set);
  const main = usePlayer();
  const clip = useVerseClip();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [ref, setRef] = useState<VerseRef>({ surah: Number(params.surah) || 1, ayah: Number(params.ayah) || 1 });
  const [verse, setVerse] = useState<Verse | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const run = useRef(0);

  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);
  useEffect(() => {
    getVerseByKey(ref.surah, ref.ayah).then(setVerse);
  }, [ref]);

  const stop = () => {
    run.current += 1;
    clip.stop();
    setPlaying(null);
    setLoading(null);
  };

  const playOne = async (id: number) => {
    setLoading(id);
    setPlaying(id);
    try {
      return await clip.play(id, ref.surah, ref.ayah, { onStart: () => setLoading(null) });
    } catch {
      setFailed((f) => new Set(f).add(id));
      return 'ended' as const;
    } finally {
      setLoading(null);
    }
  };

  const playAll = async () => {
    stop();
    main.stop();
    const token = run.current;
    for (const r of RECITERS) {
      if (token !== run.current) return;
      const end = await playOne(r.id);
      if (end === 'stopped' || token !== run.current) return;
    }
    setPlaying(null);
  };

  const single = async (id: number) => {
    if (playing === id) return stop();
    stop();
    main.stop();
    const token = run.current;
    await playOne(id);
    if (token === run.current) setPlaying(null);
  };

  const change = (v: VerseRef) => {
    stop();
    setFailed(new Set());
    setRef(v);
  };

  return (
    <Screen title={tr('قارن بين القراء', 'Compare reciters')} subtitle={tr('آية واحدة بكل الأصوات', 'One verse in every voice')}>
      <VersePicker surahs={surahs} value={ref} onChange={change} />
      {verse ? (
        <Card tone="soft">
          <QuranText size={24}>{verse.textUthmani}</QuranText>
        </Card>
      ) : null}
      <Button title={playing != null ? tr('إيقاف', 'Stop') : tr('استمع للقراء بالتتابع', 'Play all in turn')} icon={playing != null ? Square : ListMusic} onPress={playing != null ? stop : playAll} />
      <Card padded={false}>
        {RECITERS.map((r, i) => {
          const active = playing === r.id;
          return (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border, backgroundColor: active ? t.colors.primarySoft : 'transparent' }}>
              <Tap onPress={() => single(r.id)} accessibilityRole="button" accessibilityLabel={tr(`استمع إلى ${r.name}`, `Listen to ${r.name}`)} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? t.colors.primary : t.colors.primarySoft }}>
                {loading === r.id ? <ActivityIndicator color={t.colors.onPrimary} size="small" /> : active ? <Square size={14} color={t.colors.onPrimary} fill={t.colors.onPrimary} /> : <Play size={16} color={t.colors.primaryDeep} fill={t.colors.primaryDeep} />}
              </Tap>
              <View style={{ flex: 1 }}>
                <Txt weight={active ? 'semibold' : 'medium'}>{r.name}</Txt>
                <Txt variant="caption" muted>
                  {failed.has(r.id) ? tr('تعذّر التحميل', 'Could not load') : r.style}
                </Txt>
              </View>
              {r.id === reciterId ? (
                <CircleCheck size={20} color={t.colors.success} />
              ) : (
                <IconButton icon={CircleCheck} tone="plain" size={36} color={t.colors.textFaint} label={tr(`اجعل ${r.name} قارئي`, `Make ${r.name} my reciter`)} onPress={() => set({ reciterId: r.id })} />
              )}
            </View>
          );
        })}
      </Card>
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr('العلامة بجانب القارئ تجعله قارئك في المصحف والاستماع. التلاوات من Quran.com وتحتاج إلى اتصال ما لم تكن محمّلة.', 'The tick makes a reciter yours across the mushaf and listening. Recitations come from Quran.com and need a connection unless downloaded.')}
      </Txt>
    </Screen>
  );
}
