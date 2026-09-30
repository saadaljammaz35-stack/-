import { useState } from 'react';
import {
  I18nManager,
  Platform,
  Pressable,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextStyle,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useTheme } from '../theme';
import { Symbol } from './Symbol';
import { Text } from './Text';

const rowPadding = { paddingHorizontal: 16, paddingVertical: 11, minHeight: 44 } as const;

/** A label on the leading edge, an editable value on the trailing edge. */
export function TextFieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoFocus = false,
  multiline = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  multiline?: boolean;
  maxLength?: number;
}) {
  const theme = useTheme();

  const inputStyle: TextStyle = {
    ...(theme.type.body as TextStyle),
    flex: 1,
    color: theme.colors.label,
    textAlign: I18nManager.isRTL ? 'left' : 'right',
    writingDirection: 'auto',
    padding: 0,
    minHeight: multiline ? 66 : undefined,
    textAlignVertical: multiline ? 'top' : 'center',
  };

  return (
    <View style={[{ flexDirection: multiline ? 'column' : 'row', alignItems: multiline ? 'stretch' : 'center', gap: theme.space.md }, rowPadding]}>
      <Text variant="body" numberOfLines={1} style={multiline ? undefined : { maxWidth: '45%' }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.placeholderText}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        multiline={multiline}
        maxLength={maxLength}
        style={[inputStyle, multiline ? { textAlign: I18nManager.isRTL ? 'right' : 'left' } : null]}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** Opens the platform date picker. iOS gets the inline wheel it expects. */
export function DateFieldRow({
  label,
  value,
  onChange,
  maximumDate,
  minimumDate,
  formatted,
}: {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  formatted: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const inline = Platform.OS === 'ios';

  return (
    <View>
      <Pressable
        onPress={() => setOpen((previous) => !previous)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatted}`}
        style={({ pressed }) => [
          { flexDirection: 'row', alignItems: 'center' },
          rowPadding,
          pressed ? { backgroundColor: theme.colors.quaternaryFill } : null,
        ]}
      >
        <Text variant="body" style={{ flex: 1 }}>
          {label}
        </Text>
        <Text variant="body" tone={open ? 'brand' : 'secondary'} tabular>
          {formatted}
        </Text>
      </Pressable>

      {open ? (
        <View style={{ alignItems: 'center', paddingBottom: theme.space.sm }}>
          <DateTimePicker
            value={value}
            mode="date"
            display={inline ? 'inline' : 'default'}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            locale="ar-SA"
            onChange={(_event, next) => {
              if (!inline) setOpen(false);
              if (next) onChange(next);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

/** A row that opens a choice list. Shows the current selection inline. */
export function ChoiceRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
        rowPadding,
        pressed ? { backgroundColor: theme.colors.quaternaryFill } : null,
      ]}
    >
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="body" tone="secondary" numberOfLines={1} style={{ maxWidth: '55%' }}>
        {value}
      </Text>
      <Symbol name="chevron.up.chevron.down" size={12} color={theme.colors.tertiaryLabel} weight="semibold" />
    </Pressable>
  );
}

/** A −/+ stepper, used for warranty and policy day counts. */
export function StepperRow({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 120,
  unit,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit: (value: number) => string;
}) {
  const theme = useTheme();

  const nudge = (delta: number) => {
    const next = Math.max(min, Math.min(max, value + delta));
    if (next !== value) onChange(next);
  };

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }, rowPadding]}>
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="body" tone="secondary" tabular>
        {unit(value)}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.tertiaryFill,
          overflow: 'hidden',
        }}
      >
        <StepperButton symbol="minus" disabled={value <= min} onPress={() => nudge(-step)} />
        <View style={{ width: 1, backgroundColor: theme.colors.separator }} />
        <StepperButton symbol="plus" disabled={value >= max} onPress={() => nudge(step)} />
      </View>
    </View>
  );
}

function StepperButton({
  symbol,
  onPress,
  disabled,
}: {
  symbol: 'minus' | 'plus';
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={symbol === 'plus' ? 'زيادة' : 'إنقاص'}
      style={({ pressed }) => ({
        width: 42,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : pressed ? 0.5 : 1,
      })}
    >
      <Symbol name={symbol} size={14} color={theme.colors.label} weight="semibold" />
    </Pressable>
  );
}
