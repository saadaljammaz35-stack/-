// Pieces shared by the kids' hifz screens.
import { View } from 'react-native';

import { Txt } from '@/components/ui';

export function KidAvatar({ name, color, size = 46 }: { name: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Txt color="#FFFFFF" weight="bold" style={{ fontSize: size * 0.42, lineHeight: size * 0.6 }}>
        {name.trim().slice(0, 1) || '؟'}
      </Txt>
    </View>
  );
}
