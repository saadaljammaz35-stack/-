// One child's surahs: stars earned in each, a crown for each surah heard in full.
import { router, useLocalSearchParams } from 'expo-router';
import { Crown, Star } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, EmptyState, Txt } from '@/components/ui';
import { getSurahs, type Surah } from '@/data/content';
import { KidAvatar } from '@/features/kids-ui';
import { useI18n } from '@/i18n';
import { KIDS_SURAHS, kidStats, nextSurah } from '@/lib/kids';
import { useKidsStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function KidPage() {
  const t = useTheme();
  const { tr } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKidsStore((s) => s.kids.find((k) => k.id === id));
  const [surahs, setSurahs] = useState<Surah[]>([]);
  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);

  if (!kid) {
    return (
      <Screen title={tr('حفظ الصغار', 'Kids’ hifz')}>
        <EmptyState icon={Star} title={tr('لم نجد هذا الملف', 'Profile not found')} />
      </Screen>
    );
  }
  const stats = kidStats(kid);
  const counts = Object.fromEntries(surahs.map((s) => [s.id, s.versesCount]));
  const next = surahs.length ? nextSurah(kid, counts) : null;
  const open = (surah: number) => router.push({ pathname: '/kids/learn', params: { kid: kid.id, surah: String(surah) } });

  return (
    <Screen title={kid.name} subtitle={tr('حفظ الصغار', 'Kids’ hifz')}>
      <Card tone="primary" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <KidAvatar name={kid.name} color={kid.color} size={58} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Star size={22} color="#F6C945" fill="#F6C945" />
            <Txt variant="title" color="#FFFFFF">
              {stats.stars}
            </Txt>
            <Txt color="rgba(255,255,255,0.85)">{tr('نجمة', 'stars')}</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Crown size={20} color="#F6C945" />
            <Txt color="rgba(255,255,255,0.9)">{tr(`${stats.crowns} سورة حفظها كاملة`, `${stats.crowns} surahs by heart`)}</Txt>
          </View>
        </View>
      </Card>
      {next ? <Button title={tr(`تابع: سورة ${surahs[next - 1]?.name ?? ''}`, `Continue: ${surahs[next - 1]?.nameSimple ?? ''}`)} icon={Star} onPress={() => open(next)} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {KIDS_SURAHS.map((n) => {
          const s = surahs[n - 1];
          const p = kid.surahs[n];
          const learned = p?.learned.length ?? 0;
          const total = s?.versesCount ?? 0;
          const full = p?.crowned;
          return (
            <Pressable
              key={n}
              onPress={() => open(n)}
              accessibilityRole="button"
              accessibilityLabel={s ? tr(`سورة ${s.name}، ${learned} من ${total}`, `${s.nameSimple}, ${learned} of ${total}`) : String(n)}
              style={({ pressed }) => ({
                width: '31%',
                flexGrow: 1,
                minHeight: 84,
                borderRadius: t.radius.lg,
                padding: 10,
                gap: 6,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: full ? '#FFF4D6' : learned ? t.colors.primarySoft : t.colors.surface,
                borderWidth: 1,
                borderColor: full ? '#E9C46A' : t.colors.border,
                opacity: pressed ? 0.8 : 1,
              })}>
              {full ? <Crown size={18} color="#C98A0B" /> : null}
              <Txt weight="bold" center numberOfLines={1} color={full ? '#5A3D00' : undefined}>
                {s?.name ?? n}
              </Txt>
              <Txt variant="caption" muted={!full} color={full ? '#7A5A10' : undefined}>
                {total ? `${learned}/${total}` : ''}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
