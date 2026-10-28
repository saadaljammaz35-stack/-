// iOS home-screen and Lock Screen widgets (WidgetKit via expo-widgets + SwiftUI).
// Each component runs in an isolated widget runtime: everything it needs is declared inside.
import { Divider, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { aspectRatio, containerBackground, environment, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, monospacedDigit, multilineTextAlignment, padding, resizable, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, widgetsDirectory, type WidgetEnvironment } from 'expo-widgets';

import { DAILY_DEFAULT, KHATMA_DEFAULT, PENDING } from './defaults';
import type { DailyWidgetProps, DateWidgetProps, KhatmaWidgetProps, PrayerWidgetProps, WidgetHandle, WidgetPending } from './types';

type StyleConfig = { style?: 'green' | 'cream' | 'dark' };
type DailyConfig = StyleConfig & { content?: 'ayah' | 'hadith' | 'dhikr' };

type PrayerConfig = { style?: 'auto' | 'light' | 'dark' | 'green'; lock?: 'next' | 'since' };

const PrayerWidgetView = (props: PrayerWidgetProps | WidgetPending, env: WidgetEnvironment<PrayerConfig>) => {
  'widget';
  const palettes = {
    light: { bg: '#FBFAF6', fg: '#141414', muted: '#6A6A6A', accent: '#D0553D', art: 'light' },
    dark: { bg: '#15171A', fg: '#F4F1E8', muted: '#A5A29A', accent: '#F08C6E', art: 'dark' },
    green: { bg: '#2F4529', fg: '#FFFFFF', muted: '#C9D8C0', accent: '#F2C97A', art: 'dark' },
  };
  const choice = env.configuration?.style ?? 'auto';
  const c = choice === 'auto' ? (env.colorScheme === 'dark' ? palettes.dark : palettes.light) : (palettes[choice] ?? palettes.light);

  // Only the app can compute the times; until it has, show today's date and where to get them.
  if (!props || !('next' in props) || !props.next) {
    if (env.widgetFamily === 'accessoryInline') return <Text>مع الله</Text>;
    if (env.widgetFamily === 'accessoryCircular') return <Image systemName="moon.stars.fill" size={22} modifiers={[widgetURL('maallah://prayer')]} />;
    if (env.widgetFamily === 'accessoryRectangular') {
      return (
        <VStack spacing={2} alignment="center" modifiers={[widgetURL('maallah://prayer')]}>
          <Image systemName="moon.stars.fill" size={16} />
          <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>مع الله</Text>
        </VStack>
      );
    }
    const small = env.widgetFamily === 'systemSmall';
    return (
      <VStack spacing={small ? 5 : 7} alignment="center" modifiers={[containerBackground(c.bg, 'widget'), environment('locale', 'ar_SA'), widgetURL('maallah://prayer')]}>
        <Image systemName="moon.stars.fill" size={small ? 24 : 28} color={c.accent} />
        <Text modifiers={[font({ size: small ? 16 : 19, weight: 'bold' }), foregroundStyle(c.fg)]}>مواقيت الصلاة</Text>
        <Text date={env.date} dateStyle="date" modifiers={[font({ size: 12 }), foregroundStyle(c.muted)]} />
        <Text modifiers={[font({ size: small ? 11 : 12 }), foregroundStyle(c.muted), multilineTextAlignment('center'), lineLimit(2), minimumScaleFactor(0.8)]}>افتح «مع الله» لتظهر مواقيت مدينتك</Text>
      </VStack>
    );
  }

  const locale = props.lang === 'ar' ? 'ar_SA' : 'en_US';
  const art = props.artDir ? `${props.artDir}/weekday-${props.weekdayIndex}-${c.art}.png` : null;
  const nextAt = new Date(props.next.at);
  const prevAt = new Date(props.prev.at);
  const since = env.configuration?.lock === 'since';
  const order = <T,>(items: T[]): T[] => (props.reverse ? [...items].reverse() : items);

  if (env.widgetFamily === 'accessoryInline') {
    return <Text>{since ? `${props.prev.name} ${props.prev.time}` : `${props.next.name} ${props.next.time}`}</Text>;
  }
  if (env.widgetFamily === 'accessoryRectangular' || env.widgetFamily === 'accessoryCircular') {
    const p = since ? props.prev : props.next;
    const round = env.widgetFamily === 'accessoryCircular';
    return (
      <VStack spacing={0} alignment="center" modifiers={[environment('locale', locale), widgetURL('maallah://prayer')]}>
        <Text modifiers={[font({ size: round ? 11 : 14, weight: 'semibold' }), lineLimit(1)]}>{p.name}</Text>
        <Text modifiers={[font({ size: round ? 12 : 17, weight: 'bold' }), lineLimit(1), minimumScaleFactor(0.6)]}>{round ? props.prayers[props.nextIndex]?.clock ?? p.time : p.time}</Text>
        {round ? null : <Text date={since ? prevAt : nextAt} dateStyle="timer" modifiers={[font({ size: 16, weight: 'medium' }), monospacedDigit(), multilineTextAlignment('center')]} />}
      </VStack>
    );
  }

  const weekdayView = art ? (
    <Image uiImage={art} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' })]} />
  ) : (
    <Text modifiers={[font({ size: 30, weight: 'bold' }), foregroundStyle(c.fg)]}>{props.weekday}</Text>
  );
  const countdown = order([
    <Text key="label" modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(c.accent)]}>{props.remainingLabel}</Text>,
    <Spacer key="gap" />,
    <Text key="timer" date={nextAt} dateStyle="timer" modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(c.accent), monospacedDigit()]} />,
  ]);

  if (env.widgetFamily === 'systemSmall') {
    return (
      <VStack spacing={3} alignment="center" modifiers={[containerBackground(c.bg, 'widget'), environment('locale', locale), widgetURL('maallah://prayer')]}>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(c.muted), monospacedDigit()]}>{props.hijriNumeric}</Text>
        <VStack modifiers={[frame({ height: 34 })]}>{weekdayView}</VStack>
        <Spacer />
        <Text modifiers={[font({ size: 13 }), foregroundStyle(c.muted)]}>{props.remainingLabel}</Text>
        <Text date={nextAt} dateStyle="timer" modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle(c.accent), monospacedDigit(), multilineTextAlignment('center')]} />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.fg)]}>{props.next.time}</Text>
      </VStack>
    );
  }

  if (env.widgetFamily === 'systemLarge') {
    return (
      <VStack spacing={6} alignment="center" modifiers={[containerBackground(c.bg, 'widget'), environment('locale', locale), widgetURL('maallah://prayer')]}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(c.muted), monospacedDigit()]}>{props.hijriNumeric}</Text>
        <VStack modifiers={[frame({ height: 64 })]}>{weekdayView}</VStack>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted), lineLimit(1)]}>{props.city}</Text>
        <Divider />
        {props.prayers.map((p, i) => (
          <HStack key={p.name} modifiers={[padding({ vertical: 2 })]}>
            {order([
              <Text key="n" modifiers={[font({ size: 16, weight: i === props.nextIndex ? 'bold' : 'medium' }), foregroundStyle(i === props.nextIndex ? c.accent : c.fg)]}>{p.name}</Text>,
              <Spacer key="s" />,
              <Text key="t" modifiers={[font({ size: 16, weight: i === props.nextIndex ? 'bold' : 'medium' }), foregroundStyle(i === props.nextIndex ? c.accent : c.fg), monospacedDigit()]}>{p.time}</Text>,
            ])}
          </HStack>
        ))}
        <Divider />
        <HStack>{countdown}</HStack>
      </VStack>
    );
  }

  // systemMedium: the layout of the reference — date, weekday, the five prayers, the countdown.
  return (
    <VStack spacing={2} alignment="center" modifiers={[containerBackground(c.bg, 'widget'), environment('locale', locale), widgetURL('maallah://prayer')]}>
      <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(c.muted), monospacedDigit()]}>{props.hijriNumeric}</Text>
      <VStack modifiers={[frame({ height: 46 })]}>{weekdayView}</VStack>
      <HStack spacing={0} modifiers={[padding({ top: 4 })]}>
        {order(
          props.prayers.map((p, i) => (
            <VStack key={p.name} spacing={2} alignment="center" modifiers={[frame({ maxWidth: 1000 })]}>
              <Text modifiers={[font({ size: 13, weight: i === props.nextIndex ? 'bold' : 'semibold' }), foregroundStyle(i === props.nextIndex ? c.accent : c.fg), lineLimit(1), minimumScaleFactor(0.7)]}>{p.name}</Text>
              <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(i === props.nextIndex ? c.accent : c.fg), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.7)]}>{p.clock}</Text>
            </VStack>
          )),
        )}
      </HStack>
      <Divider modifiers={[padding({ vertical: 3 })]} />
      <HStack>{countdown}</HStack>
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
  const c = palettes[env.configuration?.style ?? props?.style] ?? palettes.cream;
  const kind = env.configuration?.content ?? 'ayah';
  const item = props?.[kind] ?? { text: 'مع الله', ref: '' };
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

const DateWidgetView = (props: DateWidgetProps | WidgetPending, env: WidgetEnvironment<StyleConfig>) => {
  'widget';
  const palettes = {
    green: { bg: '#2F4529', fg: '#FFFFFF', muted: '#C9D8C0', accent: '#C5E08A' },
    cream: { bg: '#FBFAF5', fg: '#1F2A1C', muted: '#6B756A', accent: '#5A6E51' },
    dark: { bg: '#141A13', fg: '#ECEFE6', muted: '#A8B2A3', accent: '#A8C29B' },
  };
  const style = props && 'style' in props ? props.style : 'cream';
  const c = palettes[env.configuration?.style ?? style] ?? palettes.cream;
  // The Hijri date comes from the app; until then show the clock and the system date.
  if (!props || !('hijri' in props) || !props.hijri) {
    if (env.widgetFamily === 'accessoryInline') return <Text date={env.date} dateStyle="date" />;
    return (
      <VStack alignment="leading" spacing={4} modifiers={[containerBackground(c.bg, 'widget'), environment('locale', 'ar_SA'), widgetURL('maallah://calendar')]}>
        <Text date={env.date} dateStyle="time" modifiers={[font({ size: 30, weight: 'bold' }), foregroundStyle(c.fg)]} />
        <Text date={env.date} dateStyle="date" modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.accent)]} />
        <Spacer />
        <Text modifiers={[font({ size: 11 }), foregroundStyle(c.muted), lineLimit(2)]}>افتح «مع الله» للتاريخ الهجري</Text>
      </VStack>
    );
  }
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
  const c = palettes[env.configuration?.style ?? props?.style] ?? palettes.green;
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

// The initial props are built into the widget extension (app.json `initialLayout`), so each
// widget has something to show before the app first updates it.
export const PrayerWidget = createWidget<PrayerWidgetProps | WidgetPending, PrayerConfig>('PrayerWidget', PrayerWidgetView, PENDING) as unknown as WidgetHandle<PrayerWidgetProps>;
export const DailyWidget = createWidget<DailyWidgetProps, DailyConfig>('DailyWidget', DailyWidgetView, DAILY_DEFAULT) as unknown as WidgetHandle<DailyWidgetProps>;
export const DateWidget = createWidget<DateWidgetProps | WidgetPending, StyleConfig>('DateWidget', DateWidgetView, PENDING) as unknown as WidgetHandle<DateWidgetProps>;
export const KhatmaWidget = createWidget<KhatmaWidgetProps, StyleConfig>('KhatmaWidget', KhatmaWidgetView, KHATMA_DEFAULT) as unknown as WidgetHandle<KhatmaWidgetProps>;
export const widgetsAvailable = true;
/** Folder shared between the app and its widgets (file:// URL). */
export const widgetFolder: string | null = widgetsDirectory ?? null;
export const supportsTimeline = true;
