// «حلقة القراءة»: start a circle (you read, everyone's mushaf follows) or join one by its code.
import { router } from 'expo-router';
import { BookOpenText, CloudOff, LogIn } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, EmptyState, Txt } from '@/components/ui';
import { inputStyle, NameField } from '@/features/group-ui';
import { halaqaAvailable, newHalaqaCode, parseHalaqaCode } from '@/features/halaqa';
import { useI18n } from '@/i18n';
import { useGroupStore, useQuranStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function Halaqa() {
  const t = useTheme();
  const { tr } = useI18n();
  const name = useGroupStore((s) => s.name);
  const lastPage = useQuranStore((s) => s.lastRead?.page ?? 1);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!halaqaAvailable) {
    return (
      <Screen title={tr('حلقة القراءة', 'Reading circle')}>
        <EmptyState icon={CloudOff} title={tr('غير متاحة في هذه النسخة', 'Not available in this build')} />
      </Screen>
    );
  }

  const start = () => {
    setError(null);
    if (!name.trim()) return setError(tr('اكتب اسمك أولًا.', 'Enter your name first.'));
    router.push({ pathname: '/halaqa/[code]', params: { code: newHalaqaCode(), lead: '1', page: String(lastPage) } });
  };
  const join = () => {
    setError(null);
    if (!name.trim()) return setError(tr('اكتب اسمك أولًا.', 'Enter your name first.'));
    const c = parseHalaqaCode(code);
    if (!c) return setError(tr('الرمز ست خانات، أو الصق رابط الدعوة كاملًا.', 'The code has six characters — or paste the whole invite link.'));
    router.push({ pathname: '/halaqa/[code]', params: { code: c } });
    setCode('');
  };

  return (
    <Screen title={tr('حلقة القراءة', 'Reading circle')} subtitle={tr('يقرأ واحد، وتتقلّب صفحات المصحف عند الجميع معه', 'One reads, and everyone’s mushaf turns with them')}>
      <Card style={{ gap: 12 }}>
        <NameField />
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt weight="semibold">{tr('ابدأ حلقة', 'Start a circle')}</Txt>
        <Txt variant="caption" muted style={{ lineHeight: 20 }}>
          {tr('أنت القارئ: كل صفحة تفتحها وكل آية تلمسها تظهر عند المستمعين في اللحظة نفسها، مهما بعدت المسافة. تبدأ من آخر صفحة قرأتها.', 'You lead: every page you open and every verse you tap shows for the listeners at once, wherever they are. Starts from your last page.')}
        </Txt>
        <Button title={tr('ابدأ وادعُ الآخرين', 'Start and invite')} icon={BookOpenText} onPress={start} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt weight="semibold">{tr('انضم إلى حلقة', 'Join a circle')}</Txt>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={tr('الرمز أو رابط الدعوة', 'Code or invite link')}
          placeholderTextColor={t.colors.textFaint}
          style={inputStyle(t)}
        />
        <Button title={tr('انضم', 'Join')} icon={LogIn} tone="soft" onPress={join} />
      </Card>

      {error ? (
        <Txt center color={t.colors.danger}>
          {error}
        </Txt>
      ) : null}
      <View style={{ gap: 4 }}>
        <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
          {tr('لا تحتاج حسابًا ولا يُحفظ شيء: يرى الحاضرون اسمك فقط، والحلقة تنتهي بخروج الجميع.', 'No account and nothing stored: those present see only your name, and the circle ends when everyone leaves.')}
        </Txt>
      </View>
    </Screen>
  );
}
