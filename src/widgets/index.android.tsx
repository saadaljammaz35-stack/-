// Android home-screen widgets (Glance via expo-widgets + Jetpack Compose). Android widgets
// only support snapshots, so the app refreshes them when the next prayer changes.
import { Column, Image, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, fillMaxWidth, height, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, widgetsDirectory, type WidgetEnvironment } from 'expo-widgets';

import { DAILY_DEFAULT, KHATMA_DEFAULT, PENDING } from './defaults';
import type { DailyWidgetProps, DateWidgetProps, KhatmaWidgetProps, PrayerWidgetProps, WidgetHandle, WidgetPending } from './types';

const PrayerWidgetView = (props: PrayerWidgetProps | WidgetPending, env: WidgetEnvironment) => {
  'widget';
  const palettes = {
    light: { bg: '#FBFAF6', fg: '#141414', muted: '#6A6A6A', accent: '#D0553D', art: 'light' },
    dark: { bg: '#15171A', fg: '#F4F1E8', muted: '#A5A29A', accent: '#F08C6E', art: 'dark' },
  };
  const c = env.colorScheme === 'dark' ? palettes.dark : palettes.light;
  // Only the app can compute the times; until it has, say where to get them.
  if (!props || !('prayers' in props) || !props.prayers) {
    return (
      <Column modifiers={[fillMaxSize(), background(c.bg), cornerRadius(24), paddingAll(14)]} horizontalAlignment="center" verticalArrangement="center">
        <Text color={c.fg} style={{ fontSize: 18, fontWeight: 'bold' }}>مواقيت الصلاة</Text>
        <Text color={c.muted} style={{ fontSize: 12 }}>افتح «مع الله» لتظهر مواقيت مدينتك</Text>
      </Column>
    );
  }
  const art = props.artDir ? `${props.artDir}/weekday-${props.weekdayIndex}-${c.art}.png` : null;
  const cells = props.prayers.map((p, i) => (
    <Column key={p.name} horizontalAlignment="center">
      <Text color={i === props.nextIndex ? c.accent : c.fg} style={{ fontSize: 12, fontWeight: 'bold' }}>{p.name}</Text>
      <Text color={i === props.nextIndex ? c.accent : c.fg} style={{ fontSize: 15, fontWeight: 'bold' }}>{p.clock}</Text>
    </Column>
  ));
  return (
    <Column modifiers={[fillMaxSize(), background(c.bg), cornerRadius(24), paddingAll(12)]} horizontalAlignment="center">
      <Text color={c.muted} style={{ fontSize: 12 }}>{props.hijriNumeric}</Text>
      {art ? (
        <Image source={{ uri: art }} contentScale="fit" contentDescription={props.weekday} modifiers={[fillMaxWidth(), height(44)]} />
      ) : (
        <Text color={c.fg} style={{ fontSize: 26, fontWeight: 'bold' }}>{props.weekday}</Text>
      )}
      <Spacer />
      <Row modifiers={[fillMaxWidth()]} horizontalArrangement="spaceEvenly">
        {props.reverse ? [...cells].reverse() : cells}
      </Row>
      <Spacer />
      <Text color={c.accent} style={{ fontSize: 13, fontWeight: 'bold' }}>{props.nextLine}</Text>
    </Column>
  );
};

const DailyWidgetView = (props: DailyWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const palettes = {
    green: { bg: '#2F4529', fg: '#FFFFFF', muted: '#C9D8C0' },
    cream: { bg: '#FBFAF5', fg: '#1F2A1C', muted: '#6B756A' },
    dark: { bg: '#141A13', fg: '#ECEFE6', muted: '#A8B2A3' },
  };
  const c = palettes[props?.style ?? (env.colorScheme === 'dark' ? 'dark' : 'cream')] ?? palettes.cream;
  if (!props?.ayah) return <Column modifiers={[fillMaxSize(), background(c.bg), cornerRadius(24)]} />;
  return (
    <Column modifiers={[fillMaxSize(), background(c.bg), cornerRadius(24), paddingAll(14)]}>
      <Text color={c.muted} style={{ fontSize: 12, fontWeight: 'bold' }}>آية اليوم</Text>
      <Text color={c.fg} maxLines={6} style={{ fontSize: 15 }}>{props.ayah.text}</Text>
      <Spacer />
      <Text color={c.muted} style={{ fontSize: 11 }}>{props.ayah.ref}</Text>
    </Column>
  );
};

const DateWidgetView = (props: DateWidgetProps | WidgetPending, env: WidgetEnvironment) => {
  'widget';
  const palettes = {
    green: { bg: '#2F4529', fg: '#FFFFFF', muted: '#C9D8C0', accent: '#C5E08A' },
    cream: { bg: '#FBFAF5', fg: '#1F2A1C', muted: '#6B756A', accent: '#5A6E51' },
    dark: { bg: '#141A13', fg: '#ECEFE6', muted: '#A8B2A3', accent: '#A8C29B' },
  };
  if (!props || !('hijri' in props) || !props.hijri) {
    const p = env.colorScheme === 'dark' ? palettes.dark : palettes.cream;
    return (
      <Column modifiers={[fillMaxSize(), background(p.bg), cornerRadius(24), paddingAll(14)]} horizontalAlignment="center" verticalArrangement="center">
        <Text color={p.fg} style={{ fontSize: 18, fontWeight: 'bold' }}>مع الله</Text>
        <Text color={p.muted} style={{ fontSize: 11 }}>افتح التطبيق للتاريخ الهجري</Text>
      </Column>
    );
  }
  const c = palettes[props.style ?? (env.colorScheme === 'dark' ? 'dark' : 'cream')] ?? palettes.cream;
  return (
    <Column modifiers={[fillMaxSize(), background(c.bg), cornerRadius(24), paddingAll(14)]}>
      <Text color={c.accent} style={{ fontSize: 14, fontWeight: 'bold' }}>{props.weekday}</Text>
      <Text color={c.fg} style={{ fontSize: 18, fontWeight: 'bold' }}>{props.hijri}</Text>
      <Text color={c.muted} style={{ fontSize: 12 }}>{props.gregorian}</Text>
      <Spacer />
      <Text color={c.accent} style={{ fontSize: 11 }}>{props.note}</Text>
    </Column>
  );
};

const KhatmaWidgetView = (props: KhatmaWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const palettes = {
    green: { bg: '#2F4529', fg: '#FFFFFF', muted: '#C9D8C0', accent: '#C5E08A' },
    cream: { bg: '#FBFAF5', fg: '#1F2A1C', muted: '#6B756A', accent: '#5A6E51' },
    dark: { bg: '#141A13', fg: '#ECEFE6', muted: '#A8B2A3', accent: '#A8C29B' },
  };
  const c = palettes[props?.style ?? (env.colorScheme === 'dark' ? 'dark' : 'green')] ?? palettes.green;
  return (
    <Column modifiers={[fillMaxSize(), background(c.bg), cornerRadius(24), paddingAll(14)]}>
      <Text color={c.muted} style={{ fontSize: 12 }}>{props.name}</Text>
      <Text color={c.accent} style={{ fontSize: 28, fontWeight: 'bold' }}>{`${props.percent}%`}</Text>
      <Spacer />
      <Text color={c.fg} style={{ fontSize: 13, fontWeight: 'bold' }}>{props.today}</Text>
      <Text color={c.muted} style={{ fontSize: 11 }}>{props.detail}</Text>
    </Column>
  );
};

// The initial props are built into the widgets (app.json `initialLayout`), so each widget has
// something to show before the app first updates it.
export const PrayerWidget = createWidget<PrayerWidgetProps | WidgetPending>('PrayerWidget', PrayerWidgetView, PENDING) as unknown as WidgetHandle<PrayerWidgetProps>;
export const DailyWidget = createWidget<DailyWidgetProps>('DailyWidget', DailyWidgetView, DAILY_DEFAULT) as unknown as WidgetHandle<DailyWidgetProps>;
export const DateWidget = createWidget<DateWidgetProps | WidgetPending>('DateWidget', DateWidgetView, PENDING) as unknown as WidgetHandle<DateWidgetProps>;
export const KhatmaWidget = createWidget<KhatmaWidgetProps>('KhatmaWidget', KhatmaWidgetView, KHATMA_DEFAULT) as unknown as WidgetHandle<KhatmaWidgetProps>;
export const widgetsAvailable = true;
/** Folder shared between the app and its widgets (file:// URL). */
export const widgetFolder: string | null = widgetsDirectory ?? null;
export const supportsTimeline = false;
