import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, Check, Pause, Play, Trash } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { confirmAsync } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Badge, Button, Card, EmptyState, ProgressBar, SwitchRow, Txt } from '@/components/ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { schedule, status } from '@/lib/khatma';
import { useKhatmaStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function KhatmaDetail() {
  const t = useTheme();
  const { tr } = useI18n();
  const fmt = useFormat();
  const { id } = useLocalSearchParams<{ id: string }>();
  const k = useKhatmaStore((s) => s.khatmas.find((x) => x.id === id));
  const store = useKhatmaStore();
  const today = useToday();
  const [showAll, setShowAll] = useState(false);
  const plan = useMemo(() => (k ? schedule(k) : []), [k]);

  if (!k) return <Screen title={tr('الختمة', 'Khatma')}><EmptyState icon={BookOpen} title={tr('الختمة غير موجودة', 'Not found')} /></Screen>;
  const s = status(k, today);
  const visible = showAll ? plan : plan.filter((d) => d.day >= Math.max(1, s.dayIndex - 2)).slice(0, 7);
  const nextPage = Math.min(604, k.progress + 1);

  return (
    <Screen
      title={k.name}
      subtitle={tr(`${s.percent}% مكتمل`, `${s.percent}% complete`)}
      actions={[
        {
          icon: Trash,
          label: tr('حذف', 'Delete'),
          onPress: () =>
            confirmAsync(tr('حذف الختمة؟', 'Delete khatma?'), k.name, tr('حذف', 'Delete'), tr('إلغاء', 'Cancel')).then((ok) => {
              if (!ok) return;
              store.remove(k.id);
              router.back();
            }),
        },
      ]}>
      <Card style={{ gap: 12 }}>
        <ProgressBar value={k.progress / 604} height={10} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Txt variant="caption" muted>
              {tr('المقروء', 'Read')}
            </Txt>
            <Txt variant="heading">{k.progress}</Txt>
          </View>
          <View>
            <Txt variant="caption" muted>
              {tr('المتبقي', 'Left')}
            </Txt>
            <Txt variant="heading">{s.pagesLeft}</Txt>
          </View>
          <View>
            <Txt variant="caption" muted>
              {tr('الأيام المتبقية', 'Days left')}
            </Txt>
            <Txt variant="heading">{s.daysLeft}</Txt>
          </View>
        </View>
        {k.status === 'completed' ? (
          <Badge label={tr(`خُتمت في ${k.completedOn}`, `Completed ${k.completedOn}`)} tone="sahih" />
        ) : s.delta < 0 ? (
          <Txt color={t.colors.danger}>{tr(`متأخر ${-s.delta} صفحة عن الخطة`, `${-s.delta} pages behind plan`)}</Txt>
        ) : (
          <Txt color={t.colors.success}>{s.delta > 0 ? tr(`متقدم ${s.delta} صفحة`, `${s.delta} pages ahead`) : tr('في الموعد', 'On track')}</Txt>
        )}
      </Card>

      {k.status !== 'completed' ? (
        <>
          <Button title={tr(`متابعة القراءة من صفحة ${nextPage}`, `Continue from page ${nextPage}`)} icon={BookOpen} onPress={() => router.push({ pathname: '/mushaf', params: { page: String(nextPage) } })} />
          {s.today ? (
            <Button
              title={tr(`أتممت ورد اليوم (حتى صفحة ${s.today.to})`, `Done today (up to page ${s.today.to})`)}
              icon={Check}
              tone="soft"
              disabled={s.today.to <= k.progress}
              onPress={() => store.read(k.id, s.today!.to, today)}
            />
          ) : null}
          <Button
            title={k.status === 'paused' ? tr('استكمال الختمة', 'Resume') : tr('إيقاف مؤقت', 'Pause')}
            icon={k.status === 'paused' ? Play : Pause}
            tone="plain"
            onPress={() => (k.status === 'paused' ? store.resume(k.id, today) : store.pause(k.id, today))}
          />
          <View style={{ backgroundColor: t.colors.surface, borderRadius: 20 }}>
            <SwitchRow
              title={tr('التذكير اليومي', 'Daily reminder')}
              subtitle={tr(`الساعة ${k.reminder.hour}:${String(k.reminder.minute).padStart(2, '0')}`, `At ${k.reminder.hour}:${String(k.reminder.minute).padStart(2, '0')}`)}
              value={k.reminder.enabled}
              onChange={(v) => store.update(k.id, { reminder: { ...k.reminder, enabled: v } })}
            />
          </View>
        </>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt weight="semibold">{tr('جدول الختمة', 'Schedule')}</Txt>
        <Pressable onPress={() => setShowAll((v) => !v)}>
          <Txt variant="caption" color={t.colors.primary}>
            {showAll ? tr('عرض المختصر', 'Show less') : tr(`عرض الجدول كاملًا (${plan.length} يومًا)`, `Full schedule (${plan.length} days)`)}
          </Txt>
        </Pressable>
      </View>
      <View style={{ backgroundColor: t.colors.surface, borderRadius: 18, overflow: 'hidden' }}>
        {visible.map((d) => {
          const isToday = d.day === s.dayIndex;
          const doneDay = d.to <= k.progress;
          return (
            <View key={d.day} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10, backgroundColor: isToday ? t.colors.primarySoft : 'transparent', borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: doneDay ? t.colors.primary : t.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                {doneDay ? <Check size={14} color="#fff" /> : <Txt variant="label">{d.day}</Txt>}
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight={isToday ? 'semibold' : 'regular'}>{tr(`الصفحات ${d.from}–${d.to}`, `Pages ${d.from}–${d.to}`)}</Txt>
                <Txt variant="label" muted>{`${fmt.weekday(d.date)} ${fmt.civil(d.date)}`}</Txt>
              </View>
              {isToday ? <Badge label={tr('اليوم', 'Today')} /> : null}
            </View>
          );
        })}
      </View>
      {k.log.length ? (
        <Card style={{ gap: 6 }}>
          <Txt weight="semibold">{tr('سجل القراءة', 'Reading log')}</Txt>
          {[...k.log].reverse().slice(0, 10).map((e, i) => (
            <Txt key={i} variant="caption" muted>
              {tr(`${e.date}: الصفحات ${e.from}–${e.to}`, `${e.date}: pages ${e.from}–${e.to}`)}
            </Txt>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
