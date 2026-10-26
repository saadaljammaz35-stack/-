import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from 'expo-alternate-app-icons';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { showMessage } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Card, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

// Names must match the expo-alternate-app-icons entries in app.json.
const ICONS = [
  { name: null, ar: 'الأصلية', en: 'Original', image: require('../../../assets/images/icon.png') },
  { name: 'Green', ar: 'الخضراء', en: 'Green', image: require('../../../assets/images/icon-green.png') },
  { name: 'Night', ar: 'الليلية', en: 'Night', image: require('../../../assets/images/icon-night.png') },
] as const;

function currentIcon(): string | null {
  try {
    return getAppIconName();
  } catch {
    return null;
  }
}

export default function AppIconSettings() {
  const t = useTheme();
  const { tr } = useI18n();
  const [active, setActive] = useState<string | null>(currentIcon);

  const choose = async (name: string | null) => {
    try {
      await setAlternateAppIcon(name);
      setActive(name);
    } catch (e) {
      showMessage(tr('تعذّر تغيير الأيقونة', 'Could not change the icon'), (e as Error).message);
    }
  };

  return (
    <Screen title={tr('أيقونة التطبيق', 'App icon')}>
      {!supportsAlternateIcons ? (
        <Card tone="soft">
          <Txt>{tr('تغيير الأيقونة متاح في تطبيق iOS وAndroid فقط.', 'Changing the icon is available in the iOS and Android app.')}</Txt>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        {ICONS.map((icon) => {
          const on = active === icon.name;
          return (
            <Pressable
              key={icon.en}
              disabled={!supportsAlternateIcons}
              onPress={() => choose(icon.name)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tr(icon.ar, icon.en)}
              style={{ flex: 1, alignItems: 'center', gap: 8 }}>
              <View style={{ borderRadius: 26, padding: 4, borderWidth: 3, borderColor: on ? t.colors.primaryDeep : 'transparent' }}>
                <Image source={icon.image} style={{ width: 84, height: 84, borderRadius: 20 }} />
                {on ? (
                  <View style={{ position: 'absolute', bottom: -6, alignSelf: 'center', backgroundColor: t.colors.fill, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={14} color="#fff" strokeWidth={3} />
                  </View>
                ) : null}
              </View>
              <Txt variant="caption" weight={on ? 'semibold' : 'regular'}>
                {tr(icon.ar, icon.en)}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      {supportsAlternateIcons ? (
        <Txt variant="caption" muted>
          {tr('قد يعرض النظام رسالة تأكيد عند تغيير الأيقونة.', 'The system may show a confirmation when the icon changes.')}
        </Txt>
      ) : null}
    </Screen>
  );
}
