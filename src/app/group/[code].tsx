import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, Check, LogOut, RefreshCw, RotateCcw, Share2, Trash2, Undo2, UserMinus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';

import { confirmAsync } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Button, Card, EmptyState, Loading, ProgressBar, Txt } from '@/components/ui';
import { getJuzStartPages } from '@/data/content';
import { claimJuz, deleteGroup, groupLink, newRound, releaseJuz, setJuzDone, viewGroup, type GroupKhatma, type GroupPart } from '@/features/group-khatma';
import { groupErrorText, NameField } from '@/features/group-ui';
import { useI18n } from '@/i18n';
import { useGroupStore } from '@/store/user';
import { useTheme } from '@/theme';

/** How often an open khatma checks for other readers' changes. */
const REFRESH_MS = 20_000;

export default function GroupKhatmaScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const params = useLocalSearchParams<{ code: string }>();
  const code = (params.code ?? '').toUpperCase();
  const name = useGroupStore((s) => s.name);
  const remember = useGroupStore((s) => s.remember);
  const forget = useGroupStore((s) => s.forget);
  const [k, setK] = useState<GroupKhatma | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [starts, setStarts] = useState<number[]>([]);

  const apply = useCallback(
    (next: GroupKhatma) => {
      setK(next);
      setMissing(false);
      remember(next.code, next.name);
    },
    [remember],
  );

  const refresh = useCallback(async () => {
    try {
      apply(await viewGroup(code));
      setError(null);
    } catch (e) {
      const text = groupErrorText(e, tr);
      if ((e as { kind?: string }).kind === 'not-found') setMissing(true);
      setError(text);
    }
  }, [code, apply, tr]);

  useEffect(() => {
    getJuzStartPages().then(setStarts);
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  const act = async (fn: () => Promise<GroupKhatma | void>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      if (next) apply(next);
    } catch (e) {
      setError(groupErrorText(e, tr));
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!k) return;
    const message = tr(
      `«${k.name}» — ختمة جماعية في تطبيق «مع الله». اختر جزءك من هنا:\n${groupLink(k.code)}\nأو أدخل الرمز ${k.code} في التطبيق.`,
      `“${k.name}” — a group khatma in the Ma Allah app. Pick your juz here:\n${groupLink(k.code)}\nor enter the code ${k.code} in the app.`,
    );
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
        await Clipboard.setStringAsync(message);
        setNote(tr('نُسخ رابط الدعوة، أرسله لمن تريد.', 'Invite link copied — send it to anyone.'));
        return;
      }
      await Share.share({ message });
    } catch {
      // The share sheet was dismissed.
    }
  };

  if (missing) {
    return (
      <Screen title={tr('الختمة الجماعية', 'Group khatma')}>
        <EmptyState
          icon={Trash2}
          title={tr('لم نجد هذه الختمة', 'Khatma not found')}
          message={tr('ربما حذفها منشئها، أو الرمز غير صحيح.', 'It may have been deleted, or the code is wrong.')}
          action={tr('إزالتها من قائمتي', 'Remove from my list')}
          onAction={() => (forget(code), router.back())}
        />
      </Screen>
    );
  }
  if (!k) {
    return (
      <Screen title={tr('الختمة الجماعية', 'Group khatma')}>
        {error ? (
          <Card style={{ gap: 12 }}>
            <Txt center>{error}</Txt>
            <Button title={tr('إعادة المحاولة', 'Try again')} icon={RefreshCw} tone="soft" onPress={refresh} />
          </Card>
        ) : (
          <Loading />
        )}
      </Screen>
    );
  }

  const parts = new Map<number, GroupPart>(k.parts.map((p) => [p.juz, p]));
  const done = k.parts.filter((p) => p.done).length;
  const taken = k.parts.length;
  const finished = done === 30;
  const sel = selected ? parts.get(selected) : undefined;
  const readers = new Set(k.parts.map((p) => p.name)).size;

  return (
    <Screen
      title={k.name}
      subtitle={tr(`الرمز ${k.code}`, `Code ${k.code}`)}
      actions={[
        { icon: RefreshCw, label: tr('تحديث', 'Refresh'), onPress: refresh },
        { icon: Share2, label: tr('دعوة', 'Invite'), onPress: share },
      ]}>
      <Card tone={finished ? 'primary' : 'surface'} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt variant="display" weight="bold" color={finished ? t.colors.onPrimary : t.colors.primaryDeep}>
            {done}
          </Txt>
          <Txt color={finished ? t.colors.onPrimary : t.colors.textMuted}>{tr('من 30 جزءًا قُرئت', 'of 30 read')}</Txt>
        </View>
        <ProgressBar value={done / 30} color={finished ? t.colors.onPrimary : undefined} />
        <Txt variant="caption" color={finished ? t.colors.onPrimary : t.colors.textMuted}>
          {finished
            ? tr('أتممتم الختمة، تقبّل الله منكم', 'The khatma is complete — may Allah accept from you all')
            : tr(`محجوز ${taken} · باقٍ ${30 - taken} بلا قارئ · ${readers} مشارك`, `${taken} taken · ${30 - taken} free · ${readers} readers`)}
          {k.completedRounds ? tr(` · ختمات سابقة: ${k.completedRounds}`, ` · ${k.completedRounds} completed before`) : ''}
        </Txt>
        {finished && k.owner ? <Button title={tr('ابدأ ختمة جديدة بالمجموعة نفسها', 'Start the next khatma')} icon={RotateCcw} tone="soft" loading={busy} onPress={() => act(() => newRound(k.code))} /> : null}
      </Card>

      {!name ? (
        <Card style={{ gap: 8 }}>
          <NameField />
          <Txt variant="caption" muted>
            {tr('اكتب اسمك ثم اختر جزءًا من الأجزاء المتاحة.', 'Enter your name, then pick a free juz.')}
          </Txt>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
        {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => {
          const p = parts.get(juz);
          const mine = p?.mine;
          const bg = p?.done ? t.colors.success : mine ? t.colors.fill : p ? t.colors.primarySoft : t.colors.surface;
          const ink = p?.done || mine ? '#FFFFFF' : t.colors.text;
          return (
            <Pressable
              key={juz}
              accessibilityRole="button"
              accessibilityLabel={tr(`الجزء ${juz}${p ? ` — ${p.name}${p.done ? '، قُرئ' : ''}` : ' — متاح'}`, `Juz ${juz}${p ? ` — ${p.name}${p.done ? ', read' : ''}` : ' — free'}`)}
              onPress={() => setSelected((s) => (s === juz ? null : juz))}
              style={({ pressed }) => ({
                width: '18%',
                aspectRatio: 0.9,
                borderRadius: t.radius.md,
                backgroundColor: bg,
                borderWidth: selected === juz ? 2.5 : p ? 0 : 1,
                borderColor: selected === juz ? t.colors.primary : t.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                opacity: pressed ? 0.8 : 1,
              })}>
              <Txt variant="subheading" weight="bold" color={p?.done && t.colors.scheme === 'dark' ? '#141A12' : ink}>
                {juz}
              </Txt>
              <Txt variant="label" numberOfLines={1} color={p?.done && t.colors.scheme === 'dark' ? '#141A12' : p ? ink : t.colors.textFaint}>
                {p ? (mine ? tr('أنت', 'You') : p.name) : tr('متاح', 'Free')}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      {selected ? (
        <Card style={{ gap: 12 }}>
          <Txt weight="semibold">
            {tr(`الجزء ${selected}`, `Juz ${selected}`)}
            {starts[selected - 1] ? tr(` — من صفحة ${starts[selected - 1]}`, ` — from page ${starts[selected - 1]}`) : ''}
          </Txt>
          {!sel ? (
            <Button
              title={tr('هذا جزئي', 'I’ll read this one')}
              icon={Check}
              disabled={!name}
              loading={busy}
              onPress={() => act(() => claimJuz(k.code, selected))}
            />
          ) : sel.mine ? (
            <View style={{ gap: 10 }}>
              <Button title={tr('اقرأه في المصحف', 'Read it in the mushaf')} icon={BookOpen} tone="soft" onPress={() => router.push({ pathname: '/mushaf', params: { page: String(starts[selected - 1] ?? 1) } })} />
              <Button
                title={sel.done ? tr('تراجع: لم أُتمه بعد', 'Undo: not finished yet') : tr('أتممت قراءته', 'I’ve finished it')}
                icon={sel.done ? Undo2 : Check}
                tone={sel.done ? 'soft' : 'primary'}
                loading={busy}
                onPress={() => act(() => setJuzDone(k.code, selected, !sel.done))}
              />
              {!sel.done ? <Button title={tr('اترك الجزء لغيري', 'Give it back')} icon={UserMinus} tone="plain" loading={busy} onPress={() => act(() => releaseJuz(k.code, selected))} /> : null}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Txt muted>{sel.done ? tr(`قرأه ${sel.name}`, `Read by ${sel.name}`) : tr(`يقرؤه ${sel.name}`, `${sel.name} is reading it`)}</Txt>
              {k.owner && !sel.done ? (
                <Button
                  title={tr('حرّر الجزء ليأخذه غيره', 'Free it for someone else')}
                  icon={UserMinus}
                  tone="plain"
                  loading={busy}
                  onPress={async () => {
                    if (await confirmAsync(tr('تحرير الجزء', 'Free this juz'), tr(`سيُزال اسم ${sel.name} من الجزء ${selected}.`, `${sel.name} will be removed from juz ${selected}.`), tr('تحرير', 'Free'), tr('إلغاء', 'Cancel'))) act(() => releaseJuz(k.code, selected));
                  }}
                />
              ) : null}
            </View>
          )}
        </Card>
      ) : (
        <Txt variant="caption" muted center>
          {tr('المس جزءًا لتأخذه أو لترى من يقرؤه.', 'Tap a juz to take it or see who is reading it.')}
        </Txt>
      )}

      {error ? (
        <Txt center color={t.colors.danger}>
          {error}
        </Txt>
      ) : null}
      {note ? (
        <Txt center muted>
          {note}
        </Txt>
      ) : null}

      <Button title={tr('ادعُ العائلة والأصدقاء', 'Invite family and friends')} icon={Share2} tone="soft" onPress={share} />
      {k.owner ? (
        <Button
          title={tr('حذف الختمة', 'Delete khatma')}
          icon={Trash2}
          tone="plain"
          onPress={async () => {
            if (!(await confirmAsync(tr('حذف الختمة', 'Delete khatma'), tr('ستُحذف الختمة لجميع المشاركين ولا يمكن التراجع.', 'It will be deleted for everyone and cannot be undone.'), tr('حذف', 'Delete'), tr('إلغاء', 'Cancel'))))
              return;
            try {
              await deleteGroup(k.code);
              forget(k.code);
              router.back();
            } catch (e) {
              setError(groupErrorText(e, tr));
            }
          }}
        />
      ) : (
        <Button
          title={tr('إزالتها من قائمتي', 'Remove from my list')}
          icon={LogOut}
          tone="plain"
          onPress={() => {
            forget(k.code);
            router.back();
          }}
        />
      )}
    </Screen>
  );
}
