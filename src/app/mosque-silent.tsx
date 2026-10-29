// «صامت في المسجد»: on Android, Do Not Disturb switches itself on just before each iqama and off
// after the prayer; on iPhone, where apps cannot silence the phone, the adhan alert reminds you.
import { router } from 'expo-router';
import { BellOff, Hourglass, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, Group, Row, SwitchRow, Txt } from '@/components/ui';
import { hasSilentAccess, mosqueSilentSupported, openSilentAccess } from '@/features/mosque-silent';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { FRIDAY_SILENT } from '@/lib/mosque-windows';
import { FARD_IDS } from '@/lib/prayer-log';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const DURATIONS = [15, 20, 30, 40];

export default function MosqueSilentScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const silent = useSettings((s) => s.mosqueSilent);
  const hint = useSettings((s) => s.notifications.silentHint);
  const set = useSettings((s) => s.set);
  const setNotifications = useSettings((s) => s.setNotifications);
  const [access, setAccess] = useState(() => hasSilentAccess());

  // Access is granted in the system settings; check again on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state === 'active' && setAccess(hasSilentAccess()));
    return () => sub.remove();
  }, []);

  return (
    <Screen title={tr('صامت في المسجد', 'Silent at the mosque')}>
      <Card tone="primary" style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BellOff size={24} color={t.colors.highlight} />
          <Txt variant="subheading" color="#FFFFFF" style={{ flex: 1 }}>
            {mosqueSilentSupported ? tr('يصمت جوالك وحده وقت الصلاة', 'Your phone silences itself for the prayer') : tr('تذكير بالصامت مع كل أذان', 'A reminder to silence your phone')}
          </Txt>
        </View>
        <Txt color="rgba(255,255,255,0.9)" style={{ lineHeight: 24 }}>
          {mosqueSilentSupported
            ? tr(
                `يفعّل «عدم الإزعاج» قبل الإقامة بدقيقتين، ويعيده كما كان بعد ${silent.minutes} دقيقة. وفي الجمعة من قبل الأذان بـ${FRIDAY_SILENT.before} دقائق إلى ${FRIDAY_SILENT.after} دقيقة بعده. وتصلك المكالمات والتنبيهات المسموح بها في إعدادات «عدم الإزعاج» عندك.`,
                `Do Not Disturb turns on two minutes before the iqama and back off after ${silent.minutes} minutes; on Friday from ${FRIDAY_SILENT.before} minutes before the adhan until ${FRIDAY_SILENT.after} after. Calls you allow in Do Not Disturb still come through.`,
              )
            : Platform.OS === 'ios'
              ? tr('لا يسمح الآيفون للتطبيقات بتغيير وضع الصامت، فيذكّرك تنبيه الأذان بذلك. ويمكنك أيضًا ضبط «التركيز» ليعمل تلقائيًا عند وصولك المسجد من إعدادات الآيفون.', 'iPhone does not let apps change silent mode, so the adhan alert reminds you. You can also set a Focus to turn on when you arrive at the mosque in iPhone Settings.')
              : tr('يعمل الكتم التلقائي في تطبيق أندرويد. هنا يمكنك تفعيل التذكير مع تنبيه الأذان.', 'Automatic silencing works in the Android app; here you can turn on the reminder.')}
        </Txt>
      </Card>

      {mosqueSilentSupported ? (
        <>
          {!access ? (
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <ShieldCheck size={20} color={t.colors.warning} />
                <Txt weight="semibold" style={{ flex: 1 }}>
                  {tr('يحتاج إذنًا مرة واحدة', 'Needs a one-time permission')}
                </Txt>
              </View>
              <Txt muted>{tr('اسمح لـ«مع الله» بالوصول إلى «عدم الإزعاج» من الإعدادات، ثم ارجع هنا.', 'Allow Ma Allah Do Not Disturb access in Settings, then come back.')}</Txt>
              <Button title={tr('فتح الإعدادات', 'Open settings')} onPress={openSilentAccess} />
            </Card>
          ) : null}
          <Group>
            <SwitchRow title={tr('الكتم التلقائي وقت الصلاة', 'Silence automatically for prayers')} value={silent.enabled && access} onChange={(v) => (v && !access ? openSilentAccess() : set({ mosqueSilent: { ...silent, enabled: v } }))} />
          </Group>
          <Card style={{ gap: 10 }}>
            <Txt weight="semibold">{tr('الصلوات', 'Prayers')}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {FARD_IDS.map((id) => (
                <Chip
                  key={id}
                  label={f.prayer(id)}
                  active={silent.prayers.includes(id)}
                  onPress={() => set({ mosqueSilent: { ...silent, prayers: silent.prayers.includes(id) ? silent.prayers.filter((x) => x !== id) : [...silent.prayers, id] } })}
                />
              ))}
            </View>
            <Txt weight="semibold">{tr('المدة', 'Duration')}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {DURATIONS.map((m) => (
                <Chip key={m} label={tr(`${m} دقيقة`, `${m} min`)} active={silent.minutes === m} onPress={() => set({ mosqueSilent: { ...silent, minutes: m } })} />
              ))}
            </View>
          </Card>
        </>
      ) : null}

      <Group>
        <SwitchRow title={tr('ذكّرني مع تنبيه الأذان', 'Remind me in the adhan alert')} subtitle={tr('«اجعل جوالك صامتًا قبل دخول المسجد»', '“Silence your phone before entering the mosque”')} value={hint.enabled} onChange={(v) => setNotifications({ silentHint: { enabled: v } })} />
        <Row icon={Hourglass} title={tr('وقت الإقامة في مسجدك', 'Iqama times at your mosque')} subtitle={tr('يُحسب الكتم منها', 'Silencing follows them')} onPress={() => router.push('/between')} />
      </Group>
    </Screen>
  );
}
