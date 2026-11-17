import { Switch } from 'react-native';

import { useTheme } from '@/design/theme';

export function Toggle({ value, onChange, testID, disabled }: { value: boolean; onChange: (v: boolean) => void; testID?: string; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Switch
      testID={testID}
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ false: c.hairline, true: c.primary }}
      thumbColor={c.scheme === 'dark' ? '#FFFDF7' : '#FFFFFF'}
      ios_backgroundColor={c.hairline}
    />
  );
}

