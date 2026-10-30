// «دائرة العائلة» and «رفيق الأذكار»: start a circle or join one by its code.
import { router } from 'expo-router';
import { CloudOff, HandHeart, LogIn, Plus, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, EmptyState, ForwardChevron, Segmented, Txt } from '@/components/ui';
import { circlesAvailable, createCircle, joinCircle, parseCircleCode, type CircleKind } from '@/features/circles';
import { groupErrorText, inputStyle, NameField } from '@/features/group-ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useGroupStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function Circles() {
  const t = useTheme();
  const { tr } = useI18n();
  const today = useToday();
  const circles = useGroupStore((s) => s.circles);
  const name = useGroupStore((s) => s.name);
  const rememberCircle = useGroupStore((s) => s.rememberCircle);
  const [kind, setKind] = useState<CircleKind>('family');
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!circlesAvailable) {
    return (
      <Screen title={tr('الدوائر', 'Circles')}>
        <EmptyState icon={CloudOff} title={tr('غير متاحة في هذه النسخة', 'Not available in this build')} />
      </Screen>
    );
  }

  const open = (c: string) => router.push({ pathname: '/circle/[code]', params: { code: c } });
  const create = async () => {
    setError(null);
    if (!name.trim()) return setError(tr('اكتب اسمك أولًا.', 'Enter your name first.'));
    setBusy('create');
    try {
      const fallback = kind === 'family' ? tr('دائرة العائلة', 'Family circle') : tr('رفيق الأذكار', 'Adhkar buddy');
      const c = await createCircle(title.trim() || fallback, kind, today);
      rememberCircle(c.code, c.name, c.kind);
      setTitle('');
      open(c.code);
    } catch (e) {
      setError(groupErrorText(e, tr, true));
    } finally {
      setBusy(null);
    }
  };
  const join = async () => {
    setError(null);
    if (!name.trim()) return setError(tr('اكتب اسمك أولًا.', 'Enter your name first.'));
    const c = parseCircleCode(code);
    if (!c) return setError(tr('الرمز ثماني خانات، أو الصق رابط الدعوة كاملًا.', 'The code has eight characters — or paste the whole invite link.'));
    setBusy('join');
    try {
      const v = await joinCircle(c, today);
      rememberCircle(v.code, v.name, v.kind);
      setCode('');
      open(v.code);
    } catch (e) {
      setError(groupErrorText(e, tr, true));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title={tr('الدوائر', 'Circles')} subtitle={tr('تعاونوا على البر: أهلك أو رفيق واحد', 'Help each other to good: your family, or one buddy')}>
      {circles.map((c) => (
        <Card key={c.code} onPress={() => open(c.code)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {c.kind === 'buddy' ? <HandHeart size={20} color={t.colors.primary} /> : <UsersRound size={20} color={t.colors.primary} />}
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" numberOfLines={1}>
                {c.name}
              </Txt>
              <Txt variant="caption" muted>
                {c.kind === 'buddy' ? tr('رفيق الأذكار', 'Adhkar buddy') : tr('دائرة العائلة', 'Family circle')}
              </Txt>
            </View>
            <ForwardChevron />
          </View>
        </Card>
      ))}

      <Card style={{ gap: 12 }}>
        <NameField />
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt weight="semibold">{tr('دائرة جديدة', 'New circle')}</Txt>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'family', label: tr('دائرة العائلة', 'Family circle') },
            { value: 'buddy', label: tr('رفيق الأذكار', 'Adhkar buddy') },
          ]}
        />
        <Txt variant="caption" muted style={{ lineHeight: 20 }}>
          {kind === 'family'
            ? tr('حتى ٢٠ فردًا. يرى كلٌّ منكم ما أتمّه الآخرون اليوم من الصلوات والأذكار والقرآن، ويشجّع بعضكم بعضًا.', 'Up to 20 people. Each of you sees what the others completed today — prayers, adhkar, Quran — and can encourage them.')
            : tr('أنت وشخص واحد. سلسلة مشتركة تكبر كل يوم يقول فيه كلاكما أذكار الصباح والمساء.', 'You and one other person. A shared streak grows each day you both say the morning and evening adhkar.')}
        </Txt>
        <TextInput value={title} onChangeText={setTitle} maxLength={60} placeholder={kind === 'family' ? tr('دائرة العائلة', 'Family circle') : tr('رفيق الأذكار', 'Adhkar buddy')} placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} />
        <Button title={tr('أنشئ وادعُ', 'Create and invite')} icon={Plus} loading={busy === 'create'} onPress={create} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt weight="semibold">{tr('انضم إلى دائرة', 'Join a circle')}</Txt>
        <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder={tr('الرمز أو رابط الدعوة', 'Code or invite link')} placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} />
        <Button title={tr('انضم', 'Join')} icon={LogIn} tone="soft" loading={busy === 'join'} onPress={join} />
      </Card>

      {error ? (
        <Txt center color={t.colors.danger}>
          {error}
        </Txt>
      ) : null}
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr('لا تحتاج حسابًا. يرى الأعضاء اسمك، وهل أتممت هذه الأربعة اليوم إن شاركتها، لا ما فاتك ولا أي عدد. خروجك يحذف ما شاركته.', 'No account needed. Members see your name and, if you share it, whether you completed these four today — never what you missed or any count. Leaving deletes what you shared.')}
      </Txt>
    </Screen>
  );
}
