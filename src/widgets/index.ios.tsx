// iOS home-screen and Lock Screen widgets (WidgetKit via expo-widgets + SwiftUI).
// Each component runs in an isolated widget runtime: everything it needs is declared inside.
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, multilineTextAlignment, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { DailyWidgetProps, DateWidgetProps, KhatmaWidgetProps, PrayerWidgetProps, WidgetHandle } from './types';

type StyleConfig = { style?: 'green' | 'cream' | 'dark' };
type DailyConfig = StyleConfig & { content?: 'ayah' | 'hadith' | 'dhikr' };

const PrayerWidgetView = (props: PrayerWidgetProps, env: WidgetEnvironment<StyleConfig>) => {
  'widget';
  const palettes = {
    green: { bg: '#2F4529', fg: '#FFFFFF', muted: '#C9D8C0', accent: '#C5E08A' },
    cream: { bg: '#FBFAF5', fg: '#1F2A1C', muted: '#6B756A', accent: '#5A6E51' },
    dark: { bg: '#141A13', fg: '#ECEFE6', muted: '#A8B2A3', accent: '#A8C29B' },
  };
  const c = palettes[env.configuration?.style ?? props.style] ?? palettes.green;
  const next = props.prayers[props.nextIndex];
  const nextAt = new Date(next.at);
  if (env.widgetFamily === 'accessoryInline') {
    return <Text>{`${next.name} ${next.time}`}</Text>;
  }
  if (env.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' })]}>{`${next.name} ${next.time}`}</Text>
        <Text date={nextAt} dateStyle="timer" modifiers={[font({ size: 15, weight: 'bold' })]} />
        <Text modifiers={[font({ size: 11 })]}>{props.city}</Text>
      </VStack>
    );
  }
  if (env.widgetFamily === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={4} modifiers={[containerBackground(c.bg, 'widget'), widgetURL('maallah://prayer')]}>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted), lineLimit(1)]}>{props.city}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 13 }), foregroundStyle(c.muted)]}>الصلاة القادمة</Text>
        <Text modifiers={[font({ size: 26, weight: 'bold' }), foregroundStyle(c.fg)]}>{next.name}</Text>
        <Text date={nextAt} dateStyle="timer" modifiers={[font({ size: 20, weight: 'semibold' }), foregroundStyle(c.accent)]} />
        <Text modifiers={[font({ size: 13 }), foregroundStyle(c.fg)]}>{next.time}</Text>
      </VStack>
    );
  }
  const rows = props.prayers.map((p, i) => (
    <VStack key={p.name} spacing={2} alignment="center">
      <Text modifiers={[font({ size: 12, weight: i === props.nextIndex ? 'bold' : 'regular' }), foregroundStyle(i === props.nextIndex ? c.accent : c.muted)]}>{p.name}</Text>
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(i === props.nextIndex ? c.accent : c.fg)]}>{p.time}</Text>
    </VStack>
  ));
  return (
    <VStack spacing={10} modifiers={[containerBackground(c.bg, 'widget'), widgetURL('maallah://prayer')]}>
      <HStack>
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(c.fg)]}>{`${props.weekday} ${props.hijri}`}</Text>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted)]}>{props.city}</Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={2}>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted)]}>{`${next.name} بعد`}</Text>
          <Text date={nextAt} dateStyle="timer" modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(c.accent)]} />
        </VStack>
      </HStack>
      <HStack spacing={6}>{rows}</HStack>
    </VStack>
  );
};

const DailyWidgetView = (props: DailyWidgetProps, env: WidgetEnvironment<DailyConfig>) => {
  'widget';
  const palettes = {
    green: { bg: '#2F4529', fg: '#FFFFFF', muted: '#C9D8C0' },
    cream: { bg: '#FBFAF5', fg: '#1F2A1C', muted: '#6B756A' },
    dark: { bg: '#141A13', fg: '#ECEFE6', muted: '#A8B2A3' },
  };
  const c = palettes[env.configuration?.style ?? props.style] ?? palettes.cream;
  const kind = env.configuration?.content ?? 'ayah';
  const item = props[kind];
  const titles = { ayah: 'آية اليوم', hadith: 'حديث اليوم', dhikr: 'ذكر اليوم' };
  const small = env.widgetFamily === 'systemSmall';
  return (
    <VStack alignment="leading" spacing={6} modifiers={[containerBackground(c.bg, 'widget'), widgetURL('maallah://')]}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(c.muted)]}>{titles[kind]}</Text>
      <Text modifiers={[font({ size: small ? 14 : 17, weight: 'medium' }), foregroundStyle(c.fg), lineLimit(small ? 6 : 8), multilineTextAlignment('leading')]}>{item.text}</Text>
      <Spacer />
      <Text modifiers={[font({ size: 11 }), foregroundStyle(c.muted), lineLimit(1)]}>{item.ref}</Text>
    </VStack>
  );
};

const DateWidgetView = (props: DateWidgetProps, env: WidgetEnvironment<StyleConfig>) => {
  'widget';
  const palettes = {
    green: { bg: '#2F4529', fg: '#FFFFFF', muted: '#C9D8C0', accent: '#C5E08A' },
    cream: { bg: '#FBFAF5', fg: '#1F2A1C', muted: '#6B756A', accent: '#5A6E51' },
    dark: { bg: '#141A13', fg: '#ECEFE6', muted: '#A8B2A3', accent: '#A8C29B' },
  };
  const c = palettes[env.configuration?.style ?? props.style] ?? palettes.cream;
  if (env.widgetFamily === 'accessoryInline') return <Text>{props.hijri}</Text>;
  return (
    <VStack alignment="leading" spacing={4} modifiers={[containerBackground(c.bg, 'widget'), widgetURL('maallah://calendar')]}>
      <Text date={env.date} dateStyle="time" modifiers={[font({ size: 30, weight: 'bold' }), foregroundStyle(c.fg)]} />
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(c.accent)]}>{props.weekday}</Text>
      <Text modifiers={[font({ size: 14 }), foregroundStyle(c.fg)]}>{props.hijri}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted)]}>{props.gregorian}</Text>
      {props.note ? <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(c.accent), lineLimit(1)]}>{props.note}</Text> : null}
    </VStack>
  );
};

const KhatmaWidgetView = (props: KhatmaWidgetProps, env: WidgetEnvironment<StyleConfig>) => {
  'widget';
  const palettes = {
    green: { bg: '#2F4529', fg: '#FFFFFF', muted: '#C9D8C0', accent: '#C5E08A' },
    cream: { bg: '#FBFAF5', fg: '#1F2A1C', muted: '#6B756A', accent: '#5A6E51' },
    dark: { bg: '#141A13', fg: '#ECEFE6', muted: '#A8B2A3', accent: '#A8C29B' },
  };
  const c = palettes[env.configuration?.style ?? props.style] ?? palettes.green;
  return (
    <VStack alignment="leading" spacing={6} modifiers={[containerBackground(c.bg, 'widget'), widgetURL('maallah://khatma'), padding({ all: 2 })]}>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted), lineLimit(1)]}>{props.name}</Text>
      <Text modifiers={[font({ size: 30, weight: 'bold' }), foregroundStyle(c.accent)]}>{`${props.percent}%`}</Text>
      <Spacer />
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.fg), lineLimit(2)]}>{props.today}</Text>
      <Text modifiers={[font({ size: 11 }), foregroundStyle(c.muted), lineLimit(1)]}>{props.detail}</Text>
    </VStack>
  );
};

export const PrayerWidget = createWidget<PrayerWidgetProps, StyleConfig>('PrayerWidget', PrayerWidgetView) as unknown as WidgetHandle<PrayerWidgetProps>;
export const DailyWidget = createWidget<DailyWidgetProps, DailyConfig>('DailyWidget', DailyWidgetView) as unknown as WidgetHandle<DailyWidgetProps>;
export const DateWidget = createWidget<DateWidgetProps, StyleConfig>('DateWidget', DateWidgetView) as unknown as WidgetHandle<DateWidgetProps>;
export const KhatmaWidget = createWidget<KhatmaWidgetProps, StyleConfig>('KhatmaWidget', KhatmaWidgetView) as unknown as WidgetHandle<KhatmaWidgetProps>;
export const widgetsAvailable = true;
export const supportsTimeline = true;
