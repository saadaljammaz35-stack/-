// The on/off switch for the live prayer countdown, shown where it is supported.
import { Timer } from 'lucide-react-native';
import { Platform } from 'react-native';

import { SwitchRow } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';

import { liveCountdownSupported } from './live-countdown';
import { ensurePermission } from './notifications';

export function LiveCountdownSwitch() {
  const { tr } = useI18n();
  const value = useSettings((s) => s.liveCountdown);
  const set = useSettings((s) => s.set);
  if (!liveCountdownSupported) return null;
  const ios = Platform.OS === 'ios';
  return (
    <SwitchRow
      icon={Timer}
      title={ios ? tr('عدّاد حيّ على شاشة القفل', 'Live countdown on the Lock Screen') : tr('عدّاد حيّ في الإشعارات', 'Live countdown in notifications')}
      subtitle={
        ios
          ? tr('الصلاة القادمة وعدّادها في شاشة القفل والجزيرة التفاعلية', 'The next prayer and its countdown on the Lock Screen and in the Dynamic Island')
          : tr('إشعار ثابت بعدّاد الصلاة القادمة ينتقل وحده إلى ما بعدها', 'A quiet ongoing notification that moves on to each next prayer by itself')
      }
      value={value}
      onChange={async (v) => {
        // Android shows it as a notification, which needs the permission.
        if (v && !ios && !(await ensurePermission(true))) return;
        set({ liveCountdown: v });
      }}
    />
  );
}
