import { ActionSheetIOS, Alert, Platform } from 'react-native';

export type SheetOption = { label: string; destructive?: boolean };

/**
 * A choice sheet. iOS gets the real `UIActionSheet`; elsewhere an alert stands
 * in, which caps out at three buttons — so long lists are iOS-only by design
 * and callers with many options should push a screen instead.
 */
export function showActionSheet(
  { title, message, options }: { title?: string; message?: string; options: SheetOption[] },
  onSelect: (index: number) => void,
): void {
  if (Platform.OS === 'ios') {
    const destructiveButtonIndex = options.findIndex((option) => option.destructive);

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: [...options.map((option) => option.label), 'إلغاء'],
        cancelButtonIndex: options.length,
        ...(destructiveButtonIndex >= 0 ? { destructiveButtonIndex } : {}),
      },
      (index) => {
        if (index < options.length) onSelect(index);
      },
    );
    return;
  }

  Alert.alert(
    title ?? '',
    message,
    [
      ...options.slice(0, 2).map((option, index) => ({
        text: option.label,
        style: option.destructive ? ('destructive' as const) : ('default' as const),
        onPress: () => onSelect(index),
      })),
      { text: 'إلغاء', style: 'cancel' as const },
    ],
    { cancelable: true },
  );
}

/** A destructive confirmation, phrased so the action is named on the button. */
export function confirmDestructive({
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
}): void {
  Alert.alert(title, message, [
    { text: 'إلغاء', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
