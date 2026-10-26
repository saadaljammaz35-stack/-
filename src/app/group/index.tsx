import { router } from 'expo-router';
import { CloudOff, LogIn, Plus, UsersRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, EmptyState, ForwardChevron, ProgressBar, Txt } from '@/components/ui';
import { createGroup, GroupError, groupsAvailable, parseGroupCode, viewGroup, type GroupKhatma } from '@/features/group-khatma';
import { groupErrorText, inputStyle } from '@/features/group-ui';
import { useI18n } from '@/i18n';
import { useGroupStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function GroupKhatmas() {
  const t = useTheme();
  const { tr } = useI18n();
  const joined = useGroupStore((s) => s.joined);
  const name = useGroupStore((s) => s.name);
  const setName = useGroupStore((s) => s.setName);
  const remember = useGroupStore((s) => s.remember);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [nameDraft, setNameDraft] = useState(name);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [views, setViews] = useState<Record<string, GroupKhatma | 'gone'>>({});

  useEffect(() => {
    if (!groupsAvailable) return;
    let alive = true;
    for (const g of joined) {
      viewGroup(g.code)
        .then((k) => alive && setViews((v) => ({ ...v, [g.code]: k })))
        .catch((e) => alive && e instanceof GroupError && e.kind === 'not-found' && setViews((v) => ({ ...v, [g.code]: 'gone' })));
    }
    return () => {
      alive = false;
    };
  }, [joined]);

  if (!groupsAvailable) {
    return (
      <Screen title={tr('الختمة الجماعية', 'Group khatma')}>
        <EmptyState icon={CloudOff} title={tr('غير متاحة في هذه النسخة', 'Not available in this build')} />
      </Screen>
    );
  }

  const create = async () => {
    setError(null);
    if (!nameDraft.trim()) return setError(tr('اكتب اسمك أولًا.', 'Enter your name first.'));
    setName(nameDraft);
    setBusy('create');
    try {
      const k = await createGroup(title.trim() || tr('ختمة العائلة', 'Family khatma'));
      remember(k.code, k.name);
      router.push({ pathname: '/group/[code]', params: { code: k.code } });
      setTitle('');
    } catch (e) {
      setError(groupErrorText(e, tr));
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    setError(null);
    const c = parseGroupCode(code);
    if (!c) return setError(tr('الرمز ثماني خانات، أو الصق رابط الدعوة كاملًا.', 'The code has eight characters — or paste the whole invite link.'));
    setBusy('join');
    try {
      const k = await viewGroup(c);
      remember(k.code, k.name);
      router.push({ pathname: '/group/[code]', params: { code: k.code } });
      setCode('');
    } catch (e) {
      setError(groupErrorText(e, tr));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title={tr('الختمة الجماعية', 'Group khatma')} subtitle={tr('ختمة واحدة، يقرأ كل واحد جزءه', 'One khatma, everyone reads their part')}>
      {joined.map((g) => {
        const k = views[g.code];
        const done = k && k !== 'gone' ? k.parts.filter((p) => p.done).length : 0;
        const mine = k && k !== 'gone' ? k.parts.filter((p) => p.mine) : [];
        return (
          <Card key={g.code} onPress={() => router.push({ pathname: '/group/[code]', params: { code: g.code } })} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <UsersRound size={20} color={t.colors.primary} />
              <Txt weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
                {k && k !== 'gone' ? k.name : g.name}
              </Txt>
              <ForwardChevron />
            </View>
            {k === 'gone' ? (
              <Txt variant="caption" color={t.colors.danger}>
                {tr('حذفها منشئها', 'Deleted by its creator')}
              </Txt>
            ) : (
              <>
                <ProgressBar value={done / 30} />
                <Txt variant="caption" muted>
                  {tr(`قُرئ ${done} من 30 جزءًا`, `${done} of 30 read`)}
                  {mine.length ? tr(` · أجزاؤك: ${mine.map((p) => p.juz).join('، ')}`, ` · yours: ${mine.map((p) => p.juz).join(', ')}`) : ''}
                </Txt>
              </>
            )}
          </Card>
        );
      })}

      <Card style={{ gap: 12 }}>
        <Txt weight="semibold">{tr('ختمة جماعية جديدة', 'New group khatma')}</Txt>
        <View style={{ gap: 6 }}>
          <Txt variant="caption" muted>
            {tr('اسمك كما يراه المشاركون', 'Your name as others will see it')}
          </Txt>
          <TextInput value={nameDraft} onChangeText={setNameDraft} onBlur={() => setName(nameDraft)} maxLength={40} placeholder={tr('مثال: أبو عبدالله', 'e.g. Abu Abdullah')} placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} />
        </View>
        <View style={{ gap: 6 }}>
          <Txt variant="caption" muted>
            {tr('اسم الختمة', 'Khatma name')}
          </Txt>
          <TextInput value={title} onChangeText={setTitle} maxLength={60} placeholder={tr('ختمة العائلة', 'Family khatma')} placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} />
        </View>
        <Button title={tr('أنشئ وادعُ الآخرين', 'Create and invite')} icon={Plus} loading={busy === 'create'} onPress={create} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt weight="semibold">{tr('انضم إلى ختمة', 'Join a khatma')}</Txt>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={tr('الرمز أو رابط الدعوة', 'Code or invite link')}
          placeholderTextColor={t.colors.textFaint}
          style={inputStyle(t)}
        />
        <Button title={tr('انضم', 'Join')} icon={LogIn} tone="soft" loading={busy === 'join'} onPress={join} />
      </Card>

      {error ? (
        <Txt center color={t.colors.danger}>
          {error}
        </Txt>
      ) : null}
      <Txt variant="caption" muted center>
        {tr('لا تحتاج حسابًا. يظهر لغيرك اسمك والأجزاء التي تختارها فقط.', 'No account needed. Others see only your name and the juz you take.')}
      </Txt>
    </Screen>
  );
}
