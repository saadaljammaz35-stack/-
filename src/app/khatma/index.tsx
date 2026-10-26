import { router } from 'expo-router';
import { BookOpen, History, Plus, UsersRound } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Badge, Button, Card, EmptyState, ProgressBar, Txt } from '@/components/ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { formatCivil, parseCivilKey } from '@/lib/hijri';
import { status } from '@/lib/khatma';
import { groupsAvailable } from '@/features/group-khatma';
import { useKhatmaStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function KhatmaList() {
  const t = useTheme();
  const { tr } = useI18n();
  const fmt = useFormat();
  const khatmas = useKhatmaStore((s) => s.khatmas);
  const today = useToday();
  const current = khatmas.filter((k) => k.status !== 'completed');
  const done = khatmas.filter((k) => k.status === 'completed');

  return (
    <Screen title={tr('الختمة', 'Khatma')} actions={[{ icon: Plus, label: tr('ختمة جديدة', 'New khatma'), onPress: () => router.push('/khatma/new') }]}>
      {current.length === 0 ? (
        <EmptyState icon={BookOpen} title={tr('ابدأ ختمتك', 'Start a khatma')} message={tr('اختر مدة الختمة أو عدد الصفحات اليومية، وسيُحسب وردك وتذكيرك تلقائيًا.', 'Pick a duration or pages per day; your daily portion and reminder are calculated for you.')} action={tr('ختمة جديدة', 'New khatma')} onAction={() => router.push('/khatma/new')} />
      ) : (
        current.map((k) => {
          const s = status(k, today);
          return (
            <Card key={k.id} onPress={() => router.push({ pathname: '/khatma/[id]', params: { id: k.id } })} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt variant="subheading" weight="bold" style={{ flex: 1 }}>
                  {k.name}
                </Txt>
                {k.status === 'paused' ? <Badge label={tr('متوقفة', 'Paused')} tone="hasan" /> : s.delta < 0 ? <Badge label={tr(`متأخر ${-s.delta} صفحة`, `${-s.delta} pages behind`)} tone="daif" /> : <Badge label={tr('في الموعد', 'On track')} tone="sahih" />}
              </View>
              <ProgressBar value={k.progress / 604} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Txt variant="caption" muted>
                  {tr(`${s.percent}% — باقٍ ${s.pagesLeft} صفحة`, `${s.percent}% — ${s.pagesLeft} pages left`)}
                </Txt>
                <Txt variant="caption" muted>
                  {tr(`تنتهي ${formatCivil(s.endsOn)}`, `Ends ${fmt.civil(s.endsOn)}`)}
                </Txt>
              </View>
              {s.today && k.status === 'active' ? (
                <Txt weight="medium" color={t.colors.primaryDeep}>
                  {s.today.to <= k.progress ? tr('أتممت ورد اليوم، بارك الله فيك', 'Today’s portion is done') : tr(`ورد اليوم: من صفحة ${Math.max(s.today.from, k.progress + 1)} إلى ${s.today.to}`, `Today: pages ${Math.max(s.today.from, k.progress + 1)}–${s.today.to}`)}
                </Txt>
              ) : null}
            </Card>
          );
        })
      )}
      {current.length ? <Button title={tr('ختمة جديدة', 'New khatma')} icon={Plus} tone="soft" onPress={() => router.push('/khatma/new')} /> : null}
      {groupsAvailable ? (
        <Card onPress={() => router.push('/group')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <UsersRound size={24} color={t.colors.primary} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold">{tr('ختمة جماعية', 'Group khatma')}</Txt>
            <Txt variant="caption" muted>
              {tr('ادعُ عائلتك أو أصدقاءك، ويأخذ كل واحد جزءًا', 'Invite family or friends; each takes a juz')}
            </Txt>
          </View>
        </Card>
      ) : null}
      {done.length ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <History size={18} color={t.colors.textMuted} />
            <Txt weight="semibold" muted>
              {tr('سجل الختمات السابقة', 'Completed khatmas')}
            </Txt>
          </View>
          {done.map((k) => (
            <Card key={k.id} onPress={() => router.push({ pathname: '/khatma/[id]', params: { id: k.id } })}>
              <Txt weight="medium">{k.name}</Txt>
              <Txt variant="caption" muted>
                {tr(`من ${formatCivil(parseCivilKey(k.startDate))} إلى ${k.completedOn ? formatCivil(parseCivilKey(k.completedOn)) : ''}`, `${fmt.civil(parseCivilKey(k.startDate))} → ${k.completedOn ? fmt.civil(parseCivilKey(k.completedOn)) : ''}`)}
              </Txt>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
