// A child's session with one surah: hear a verse (three times), say it back, earn its star. At the
// end, the whole surah plays once more and a parent can crown it after hearing it from memory.
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { Crown, Headphones, Pause, RotateCcw, Star } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, EmptyState, IconButton, Loading, QuranText, Txt } from '@/components/ui';
import { getSurahs, getSurahVerses, type Surah, type Verse } from '@/data/content';
import { usePlayer } from '@/features/audio/player';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';
import { useSettings } from '@/store/settings';
import { useKidsStore } from '@/store/user';
import { useTheme } from '@/theme';

const GOLD = '#F2B705';

export default function KidLearn() {
  const t = useTheme();
  const { tr } = useI18n();
  const params = useLocalSearchParams<{ kid: string; surah: string }>();
  const surahId = Number(params.surah) || 1;
  const kid = useKidsStore((s) => s.kids.find((k) => k.id === params.kid));
  const learn = useKidsStore((s) => s.learn);
  const crown = useKidsStore((s) => s.crown);
  const reset = useKidsStore((s) => s.reset);
  const haptics = useSettings((s) => s.haptics);
  const player = usePlayer();
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
  });

  const [surah, setSurah] = useState<Surah | null>(null);
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [pop] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let alive = true;
    Promise.all([getSurahs(), getSurahVerses(surahId)]).then(([s, v]) => {
      if (!alive) return;
      setSurah(s[surahId - 1] ?? null);
      setVerses(v);
    });
    return () => {
      alive = false;
    };
  }, [surahId]);

  // Stop the reciter when leaving.
  useEffect(
    () => () => {
      const p = playerRef.current;
      p.setRepeat({ kind: 'off' });
      if (p.now?.kind === 'quran') p.stop();
    },
    [],
  );

  const listen = useCallback((v: Verse) => {
    const p = playerRef.current;
    p.setRepeat({ kind: 'range', from: v.ayah, to: v.ayah, times: 3 });
    p.playSurah(v.surah, v.ayah);
  }, []);
  const listenAll = useCallback(() => {
    const p = playerRef.current;
    p.setRepeat({ kind: 'off' });
    p.playSurah(surahId, 1);
  }, [surahId]);

  if (!kid) {
    return (
      <Screen title={tr('حفظ الصغار', 'Kids’ hifz')}>
        <EmptyState icon={Star} title={tr('لم نجد هذا الملف', 'Profile not found')} />
      </Screen>
    );
  }
  if (!verses || !surah) {
    return (
      <Screen title={tr('حفظ الصغار', 'Kids’ hifz')}>
        <Loading />
      </Screen>
    );
  }

  const learned = kid.surahs[surahId]?.learned ?? [];
  const crowned = kid.surahs[surahId]?.crowned ?? false;
  // Start at the first verse not yet learned; past the last verse is the "well done" page.
  const firstOpen = verses.findIndex((v) => !learned.includes(v.ayah));
  const at = index ?? (firstOpen < 0 ? verses.length : firstOpen);
  const verse = verses[at] as Verse | undefined;
  const playingThis = Boolean(verse && player.now?.kind === 'quran' && player.now.surah === verse.surah && player.now.ayah === verse.ayah && player.playing);

  const saidIt = () => {
    if (!verse) return;
    learn(kid.id, surahId, verse.ayah);
    if (haptics && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    pop.setValue(0);
    Animated.sequence([Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 4 }), Animated.delay(450), Animated.timing(pop, { toValue: 0, duration: 200, useNativeDriver: true })]).start();
    playerRef.current.stop();
    setIndex(at + 1);
  };

  return (
    <Screen title={tr(`سورة ${surah.name}`, surah.nameSimple)} subtitle={kid.name}>
      {/* One star per verse, filled once learned. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
        {verses.map((v, i) => {
          const done = learned.includes(v.ayah);
          return (
            <Pressable key={v.id} onPress={() => setIndex(i)} accessibilityLabel={tr(`الآية ${v.ayah}`, `Verse ${v.ayah}`)} hitSlop={4}>
              <Star size={i === at ? 26 : 20} color={done ? GOLD : t.colors.textFaint} fill={done ? GOLD : 'transparent'} />
            </Pressable>
          );
        })}
      </View>

      {verse ? (
        <>
          <Card style={{ minHeight: 200, justifyContent: 'center', gap: 10, backgroundColor: t.colors.mushafPaper }}>
            <Txt variant="caption" muted center>
              {tr(`الآية ${at + 1} من ${verses.length}`, `Verse ${at + 1} of ${verses.length}`)}
            </Txt>
            <QuranText size={verse.textQpc.length > 120 ? 26 : 32}>{`${verse.textQpc} ${toArabicDigits(verse.ayah)}`}</QuranText>
          </Card>
          <Button title={playingThis ? tr('إيقاف', 'Pause') : tr('اسمع الآية', 'Hear the verse')} icon={playingThis ? Pause : Headphones} tone="soft" onPress={() => (playingThis ? player.toggle() : listen(verse))} style={{ minHeight: 60 }} />
          <Button title={tr('قلتها!', 'I said it!')} icon={Star} onPress={saidIt} style={{ minHeight: 64 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt variant="caption" color={t.colors.primary} onPress={at > 0 ? () => setIndex(at - 1) : undefined} style={{ opacity: at > 0 ? 1 : 0.3, padding: 6 }}>
              {tr('السابقة', 'Previous')}
            </Txt>
            <Txt variant="caption" color={t.colors.primary} onPress={() => setIndex(at + 1)} style={{ padding: 6 }}>
              {tr('التالية', 'Next')}
            </Txt>
          </View>
        </>
      ) : (
        <Card tone="primary" style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
          {crowned ? <Crown size={54} color="#F6C945" /> : <Star size={54} color="#F6C945" fill="#F6C945" />}
          <Txt variant="title" color="#FFFFFF" center>
            {tr(`أحسنت يا ${kid.name}!`, `Well done, ${kid.name}!`)}
          </Txt>
          <Txt color="rgba(255,255,255,0.92)" center style={{ lineHeight: 24 }}>
            {crowned
              ? tr(`حفظت سورة ${surah.name} كاملة. بارك الله فيك.`, `You know ${surah.nameSimple} by heart. May Allah bless you.`)
              : tr(`نلت ${learned.length} نجمة من ${verses.length}. اسمع السورة كاملة ثم اقرأها على أبيك أو أمك.`, `${learned.length} of ${verses.length} stars. Hear the whole surah, then recite it to a parent.`)}
          </Txt>
          <Button title={tr('اسمع السورة كاملة', 'Hear the whole surah')} icon={Headphones} tone="soft" onPress={listenAll} style={{ alignSelf: 'stretch' }} />
          {crowned ? null : (
            <Button title={tr('للوالدين: سمعته يقرؤها كاملة من حفظه 👑', 'Parent: I heard it all from memory 👑')} icon={Crown} tone="soft" onPress={() => crown(kid.id, surahId, verses.length)} style={{ alignSelf: 'stretch' }} />
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <IconButton icon={RotateCcw} label={tr('ابدأ السورة من جديد', 'Start the surah again')} onPress={() => (reset(kid.id, surahId), setIndex(0))} />
          </View>
        </Card>
      )}

      {/* The star that pops up after "I said it!". */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', top: '35%', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.4] }) }] }}>
        <Star size={120} color={GOLD} fill={GOLD} />
      </Animated.View>
    </Screen>
  );
}
