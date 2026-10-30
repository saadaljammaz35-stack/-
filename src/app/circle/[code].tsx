// One circle: what each member completed today (only what they chose to share), a word of
// encouragement for each, and — for an adhkar buddy — the streak of days both said their adhkar.
import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, Check, Flame, Heart, LogOut, Moon, RefreshCw, Share2, Sunrise, UsersRound, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, View } from 'react-native';

import { confirmAsync } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Button, Card, Loading, Txt } from '@/components/ui';
import { CIRCLE_LIMIT, circleLink, cheer, joinCircle, leaveCircle, parseCircleCode, reportDay, viewCircle, viewWeek, type Circle, type DayFlags } from '@/features/circles';
import { useDayDone } from '@/features/home/daily-ring';
import { groupErrorText, NameField } from '@/features/group-ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { civilKey, civilWeekday } from '@/lib/hijri';
import { arabicDays } from '@/lib/arabic';
import { useGroupStore } from '@/store/user';
import { useTheme } from '@/theme';

const FLAGS: { id: keyof DayFlags; icon: LucideIcon; ar: string; en: string; color: string }[] = [
  { id: 'prayers', icon: UsersRound, ar: 'الصلوات الخمس', en: 'Five prayers', color: '#1F7A55' },
  { id: 'morning', icon: Sunrise, ar: 'أذكار الصباح', en: 'Morning adhkar', color: '#E09A3E' },
  { id: 'evening', icon: Moon, ar: 'أذكار المساء', en: 'Evening adhkar', color: '#6F6BC0' },
  { id: 'quran', icon: BookOpen, ar: 'القرآن', en: 'Quran', color: '#B98A2E' },
];

export default function CircleRoom() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const params = useLocalSearchParams<{ code: string }>();
  const code = parseCircleCode(params.code ?? '') ?? '';
  const name = useGroupStore((s) => s.name);
  const rememberCircle = useGroupStore((s) => s.rememberCircle);
  const forgetCircle = useGroupStore((s) => s.forgetCircle);
  const local = useDayDone(today);
  const [c, setC] = useState<Circle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [week, setWeek] = useState<Awaited<ReturnType<typeof viewWeek>> | null>(null);

  const load = useCallback(
    () =>
      viewCircle(code, today)
        .then((v) => (setC(v), setError(null)))
        .catch((e) => setError(groupErrorText(e, tr, true))),
    [code, today, tr],
  );
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => {
    if (c?.member) rememberCircle(c.code, c.name, c.kind);
  }, [c?.member, c?.code, c?.name, c?.kind, rememberCircle]);

  const act = async (f: () => Promise<Circle>) => {
    setBusy(true);
    try {
      setC(await f());
      setError(null);
    } catch (e) {
      setError(groupErrorText(e, tr, true));
    } finally {
      setBusy(false);
    }
  };

  if (!c) {
    return <Screen title={tr('الدائرة', 'Circle')}>{error ? <Txt center color={t.colors.danger}>{error}</Txt> : <Loading />}</Screen>;
  }

  const me = c.members.find((m) => m.mine);
  const mine: DayFlags = { prayers: !!me?.prayers, morning: !!me?.morning, evening: !!me?.evening, quran: !!me?.quran };
  const fromLog = FLAGS.some((f) => local[f.id] && !mine[f.id]);
  const buddy = c.kind === 'buddy';
  const other = buddy ? c.members.find((m) => !m.mine) : undefined;

  const invite = () =>
    Share.share({
      message: buddy
        ? tr(`كن رفيقي في الأذكار على تطبيق «مع الله»: نذكّر بعضنا كل صباح ومساء.\n${circleLink(c.code)}\nأو أدخل الرمز ${c.code} في «الدوائر».`, `Be my adhkar buddy in the Ma Allah app:\n${circleLink(c.code)}\nor enter the code ${c.code} under “Circles”.`)
        : tr(`«${c.name}» — دائرة عائلتنا في تطبيق «مع الله»: نتعاون على الصلاة والأذكار والقرآن.\n${circleLink(c.code)}\nأو أدخل الرمز ${c.code} في «الدوائر».`, `“${c.name}” — our family circle in the Ma Allah app:\n${circleLink(c.code)}\nor enter the code ${c.code} under “Circles”.`),
    }).catch(() => undefined);
  const leave = async () => {
    const ok = await confirmAsync(
      c.owner ? tr('حذف الدائرة؟', 'Delete the circle?') : tr('الخروج من الدائرة؟', 'Leave the circle?'),
      c.owner ? tr('أنشأتها أنت، فخروجك يحذفها عند الجميع.', 'You created it, so leaving deletes it for everyone.') : tr('يُحذف ما شاركته فيها.', 'What you shared in it is deleted.'),
      c.owner ? tr('حذف', 'Delete') : tr('خروج', 'Leave'),
      tr('إلغاء', 'Cancel'),
    );
    if (!ok) return;
    try {
      await leaveCircle(c.code);
      forgetCircle(c.code);
      router.back();
    } catch (e) {
      setError(groupErrorText(e, tr, true));
    }
  };

  return (
    <Screen
      title={c.name}
      subtitle={buddy ? tr('رفيق الأذكار', 'Adhkar buddy') : tr(`دائرة العائلة · ${c.members.length} من ${CIRCLE_LIMIT.family}`, `Family circle · ${c.members.length} of ${CIRCLE_LIMIT.family}`)}
      actions={[
        { icon: RefreshCw, label: tr('تحديث', 'Refresh'), onPress: load },
        { icon: Share2, label: tr('دعوة', 'Invite'), onPress: invite },
      ]}>
      {!c.member ? (
        <Card style={{ gap: 12 }}>
          <Txt weight="semibold">{buddy ? tr('دُعيت لتكون رفيقًا في الأذكار', 'You are invited as an adhkar buddy') : tr('دُعيت إلى هذه الدائرة', 'You are invited to this circle')}</Txt>
          <NameField />
          <Button title={tr('انضم', 'Join')} loading={busy} disabled={!name.trim()} onPress={() => act(() => joinCircle(c.code, today))} />
        </Card>
      ) : null}

      {buddy ? (
        <Card tone="primary" style={{ gap: 8, alignItems: 'center' }}>
          <Flame size={30} color={t.colors.highlight} />
          <Txt variant="title" color="#FFFFFF">
            {c.streak ? tr(arabicDays(c.streak), `${c.streak} days`) : tr('ابدآ اليوم', 'Start today')}
          </Txt>
          <Txt color="rgba(255,255,255,0.9)" center style={{ lineHeight: 24 }}>
            {other
              ? tr(`سلسلتك مع ${other.name}: الأيام المتتالية التي قال فيها كلاكما أذكار الصباح والمساء.`, `Your streak with ${other.name}: consecutive days you both said the morning and evening adhkar.`)
              : tr('ادعُ رفيقك ليبدأ العدّ.', 'Invite your buddy to start counting.')}
          </Txt>
          {!other && c.member ? <Button title={tr('ادعُ رفيقك', 'Invite your buddy')} icon={Share2} tone="soft" onPress={invite} /> : null}
        </Card>
      ) : null}

      {me ? (
        <Card style={{ gap: 12 }}>
          <Txt weight="semibold">{tr('يومك', 'Your day')}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(buddy ? FLAGS.filter((f) => f.id === 'morning' || f.id === 'evening') : FLAGS).map((f) => {
              const on = mine[f.id];
              return (
                <Pressable
                  key={f.id}
                  disabled={busy}
                  onPress={() => act(() => reportDay(c.code, today, { ...mine, [f.id]: !on }))}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: t.radius.pill, backgroundColor: on ? f.color : t.colors.surfaceAlt }}>
                  {on ? <Check size={16} color="#FFFFFF" /> : <f.icon size={16} color={t.colors.textMuted} />}
                  <Txt variant="caption" weight="semibold" color={on ? '#FFFFFF' : t.colors.text}>
                    {tr(f.ar, f.en)}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          {fromLog ? (
            <Button
              title={tr('شارك من سجلّي في التطبيق', 'Share from my log in the app')}
              tone="soft"
              loading={busy}
              onPress={() => act(() => reportDay(c.code, today, { prayers: mine.prayers || local.prayers, morning: mine.morning || local.morning, evening: mine.evening || local.evening, quran: mine.quran || local.quran }))}
            />
          ) : null}
          <Txt variant="caption" muted>
            {tr('لا يُشارك شيء إلا بلمستك. يظهر للأعضاء ما أتممته فقط.', 'Nothing is shared without your tap. Members see only what you completed.')}
          </Txt>
        </Card>
      ) : null}

      <Card padded={false}>
        {c.members.map((m, i) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Txt weight="semibold" numberOfLines={1}>
                {m.mine ? tr(`${m.name} (أنت)`, `${m.name} (you)`) : m.name}
              </Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(buddy ? FLAGS.filter((f) => f.id === 'morning' || f.id === 'evening') : FLAGS).map((f) => (
                  <View key={f.id} accessibilityLabel={`${tr(f.ar, f.en)}: ${m[f.id] ? tr('تم', 'done') : tr('لم يُشارَك', 'not shared')}`} style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: m[f.id] ? f.color : t.colors.surfaceAlt }}>
                    <f.icon size={15} color={m[f.id] ? '#FFFFFF' : t.colors.textFaint} />
                  </View>
                ))}
              </View>
            </View>
            {m.mine ? (
              m.cheers ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Heart size={16} color={t.colors.danger} fill={t.colors.danger} />
                  <Txt variant="caption">{m.cheers}</Txt>
                </View>
              ) : null
            ) : (
              <Pressable
                disabled={busy || m.cheered || !c.member}
                onPress={() => act(() => cheer(c.code, m.id, today))}
                accessibilityRole="button"
                accessibilityLabel={tr(`شجّع ${m.name}`, `Encourage ${m.name}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceAlt, opacity: m.cheered ? 0.7 : 1 }}>
                <Heart size={16} color={t.colors.danger} fill={m.cheered ? t.colors.danger : 'transparent'} />
                <Txt variant="caption">{m.cheered ? tr('شجّعته', 'Sent') : tr('شجّع', 'Cheer')}</Txt>
              </Pressable>
            )}
          </View>
        ))}
      </Card>

      {!buddy && c.member ? (
        week ? (
          <Card style={{ gap: 10 }}>
            <Txt weight="semibold">{tr('لوحة الأسبوع', 'This week')}</Txt>
            {week[week.length - 1].circle.members.map((m) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt style={{ width: 90 }} numberOfLines={1}>
                  {m.name}
                </Txt>
                {week.map(({ day, circle }) => {
                  const d = circle.members.find((x) => x.id === m.id);
                  const n = d ? FLAGS.filter((f) => d[f.id]).length : 0;
                  return <View key={civilKey(day)} accessibilityLabel={`${f.weekday(day)}: ${n}/4`} style={{ flex: 1, height: 22, borderRadius: 6, backgroundColor: n ? t.colors.primary : t.colors.surfaceAlt, opacity: n ? 0.35 + (n / 4) * 0.65 : 1 }} />;
                })}
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ width: 90 }} />
              {week.map(({ day }) => (
                <Txt key={civilKey(day)} variant="label" muted center style={{ flex: 1 }}>
                  {f.weekdayShort(civilWeekday(day))}
                </Txt>
              ))}
            </View>
            <Txt variant="caption" muted>
              {tr('كلما اشتد اللون زاد ما أتمّه من الأربعة.', 'The deeper the colour, the more of the four completed.')}
            </Txt>
          </Card>
        ) : (
          <Button title={tr('لوحة الأسبوع', 'This week')} tone="soft" loading={busy} onPress={() => (setBusy(true), viewWeek(c.code, today).then(setWeek).catch((e) => setError(groupErrorText(e, tr, true))).finally(() => setBusy(false)))} />
        )
      ) : null}

      {error ? (
        <Txt center color={t.colors.danger}>
          {error}
        </Txt>
      ) : null}
      {c.member ? <Button title={c.owner ? tr('حذف الدائرة', 'Delete circle') : tr('الخروج من الدائرة', 'Leave circle')} icon={LogOut} tone="plain" onPress={leave} /> : null}
      <Txt variant="caption" muted center style={{ lineHeight: 20 }} onPress={() => router.push({ pathname: '/hadith/enc/[id]', params: { id: '66266' } })}>
        {tr('«إِنَّ المُؤْمِنَ لِلْمُؤْمِنِ كَالْبُنْيَانِ يَشُدُّ بَعْضُهُ بَعْضًا» متفق عليه', '“A believer to another believer is like a building whose parts support one another.” Agreed upon')}
      </Txt>
    </Screen>
  );
}
