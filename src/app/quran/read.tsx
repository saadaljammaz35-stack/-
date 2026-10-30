// «مصحف ميسّر لقارئ الشاشة»: a surah as a plain list of verses, each read aloud by VoiceOver or
// TalkBack from its plain text, with its number and the surah, and playable on its own.
import { useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { IconButton, Loading, QuranText, Txt } from '@/components/ui';
import { getSurahs, getSurahVerses, type Surah, type Verse } from '@/data/content';
import { usePlayer } from '@/features/audio/player';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';
import { useTheme } from '@/theme';

export default function AccessibleSurah() {
  const t = useTheme();
  const { tr, isRTL } = useI18n();
  const params = useLocalSearchParams<{ surah?: string }>();
  const [surah, setSurah] = useState(() => Math.min(114, Math.max(1, Number(params.surah) || 1)));
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loaded, setLoaded] = useState<{ surah: number; verses: Verse[] } | null>(null);
  const player = usePlayer();

  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);
  useEffect(() => {
    let alive = true;
    getSurahVerses(surah).then((v) => alive && setLoaded({ surah, verses: v }));
    return () => {
      alive = false;
    };
  }, [surah]);
  const verses = loaded?.surah === surah ? loaded.verses : null;
  const info = surahs[surah - 1];
  const Next = isRTL ? ChevronLeft : ChevronRight;
  const Prev = isRTL ? ChevronRight : ChevronLeft;

  const play = (v: Verse) => {
    player.setRepeat({ kind: 'range', from: v.ayah, to: v.ayah, times: 1 });
    player.playSurah(v.surah, v.ayah);
  };

  return (
    <Screen title={info ? `سورة ${info.name}` : tr('المصحف الميسّر', 'Accessible mushaf')} subtitle={tr('مهيّأ لقارئ الشاشة', 'Made for screen readers')} scroll={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 }}>
        <IconButton icon={Prev} label={tr('السورة السابقة', 'Previous surah')} onPress={() => setSurah((s) => Math.max(1, s - 1))} disabled={surah <= 1} />
        <Txt center style={{ flex: 1 }} accessibilityRole="header">
          {info ? tr(`السورة ${surah} · ${info.versesCount} آية`, `Surah ${surah} · ${info.versesCount} verses`) : ''}
        </Txt>
        <IconButton icon={Next} label={tr('السورة التالية', 'Next surah')} onPress={() => setSurah((s) => Math.min(114, s + 1))} disabled={surah >= 114} />
      </View>
      {!verses ? (
        <Loading />
      ) : (
        <FlatList
          data={verses}
          keyExtractor={(v) => String(v.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.colors.surface, borderRadius: 16, padding: 12 }}>
              <View accessible accessibilityLabel={tr(`الآية ${item.ayah}: ${item.textSimple}`, `Verse ${item.ayah}: ${item.textSimple}`)} style={{ flex: 1 }}>
                <QuranText size={22} style={{ textAlign: 'right' }}>{`${item.textQpc} ${toArabicDigits(item.ayah)}`}</QuranText>
              </View>
              <Pressable onPress={() => play(item)} accessibilityRole="button" accessibilityLabel={tr(`استمع للآية ${item.ayah}`, `Listen to verse ${item.ayah}`)} hitSlop={8} style={{ padding: 6 }}>
                <Play size={20} color={t.colors.primary} />
              </Pressable>
            </View>
          )}
        />
      )}
    </Screen>
  );
}
