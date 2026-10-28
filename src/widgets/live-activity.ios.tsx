// The live prayer countdown on the Lock Screen and in the Dynamic Island (iOS Live Activity).
// The timer runs on its own; when the prayer comes the activity turns stale and announces it,
// until the app next runs and moves it on to the following prayer.
import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, lineLimit, monospacedDigit, multilineTextAlignment, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { LiveActivityHandle, PrayerActivityProps } from './types';

const PrayerActivityView = (props: PrayerActivityProps, env: LiveActivityEnvironment) => {
  'widget';
  const accent = env.isLuminanceReduced ? '#FFFFFF' : env.colorScheme === 'dark' ? '#F2C97A' : '#2F6B3A';
  const muted = env.colorScheme === 'dark' ? '#B9C2B4' : '#5F6A5B';
  const at = new Date(props.at);
  const icon = props.night ? 'moon.stars.fill' : 'sun.max.fill';
  const due = env.isStale === true;
  const reverse = props.reverse;
  const row = <T,>(items: T[]): T[] => (reverse ? [...items].reverse() : items);
  const timer = (size: number) => <Text date={at} dateStyle="timer" modifiers={[font({ size, weight: 'bold' }), foregroundStyle(accent), monospacedDigit(), multilineTextAlignment('center')]} />;

  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ horizontal: 18, vertical: 14 })]}>
        {row([
          <VStack key="name" alignment="leading" spacing={2}>
            <Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>{due ? props.dueLabel : props.remainingLabel}</Text>
            <Text modifiers={[font({ size: 22, weight: 'bold' })]}>{props.name}</Text>
            <Text modifiers={[font({ size: 13 }), foregroundStyle(muted), lineLimit(1)]}>{`${props.time} · ${props.city}`}</Text>
          </VStack>,
          <Spacer key="gap" />,
          due ? <Image key="timer" systemName="bell.fill" size={28} color={accent} /> : <VStack key="timer" modifiers={[frame({ width: 132 })]}>{timer(30)}</VStack>,
        ])}
      </HStack>
    ),
    compactLeading: <Image systemName={icon} color={accent} />,
    compactTrailing: due ? <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(accent)]}>{props.name}</Text> : <VStack modifiers={[frame({ width: 58 })]}>{timer(14)}</VStack>,
    minimal: <Image systemName={icon} color={accent} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 6, top: 6 })]}>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(muted)]}>{due ? props.dueLabel : props.remainingLabel}</Text>
        <Text modifiers={[font({ size: 20, weight: 'bold' })]}>{props.name}</Text>
      </VStack>
    ),
    expandedTrailing: due ? (
      <Image systemName="bell.fill" size={24} color={accent} />
    ) : (
      <VStack modifiers={[frame({ width: 120 }), padding({ trailing: 6, top: 6 })]}>{timer(26)}</VStack>
    ),
    expandedBottom: (
      <Text modifiers={[font({ size: 13 }), foregroundStyle(muted), lineLimit(1)]}>{`${props.time} · ${props.city} · مع الله`}</Text>
    ),
  };
};

export const PrayerActivity: LiveActivityHandle<PrayerActivityProps> | null = createLiveActivity<PrayerActivityProps>('PrayerActivity', PrayerActivityView) as unknown as LiveActivityHandle<PrayerActivityProps>;
