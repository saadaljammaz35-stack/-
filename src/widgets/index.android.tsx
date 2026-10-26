// Android home-screen widgets (Glance via expo-widgets + Jetpack Compose). Android widgets
// only support snapshots, so the app refreshes them when the next prayer changes.
import { Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { DailyWidgetProps, DateWidgetProps, KhatmaWidgetProps, PrayerWidgetProps, WidgetHandle } from './types';

const PrayerWidgetView = (props: PrayerWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const palettes = {
    green: { bg: '#2F4529', fg: '#FFFFFF', muted: '#C9D8C0', accent: '#C5E08A' },
    cream: { bg: '#FBFAF5', fg: '#1F2A1C', muted: '#6B756A', accent: '#5A6E51' },
    dark: { bg: '#141A13', fg: '#ECEFE6', muted: '#A8B2A3', accent: '#A8C29B' },
  };
  const style = props.style ?? (env.colorScheme === 'dark' ? 'dark' : 'green');
  const c = palettes[style] ?? palettes.green;
  const next = props.prayers[props.nextIndex];
  return (
    <Column modifiers={[fillMaxSize(), background(c.bg), cornerRadius(24), paddingAll(14)]}>
      <Text color={c.muted} style={{ fontSize: 12 }}>{`${props.weekday} ${props.hijri} — ${props.city}`}</Text>
      <Text color={c.fg} style={{ fontSize: 22, fontWeight: 'bold' }}>{`${next.name} ${next.time}`}</Text>
      <Spacer />
      <Row modifiers={[fillMaxWidth()]} horizontalArrangement="spaceBetween">
        {props.prayers.map((p, i) => (
          <Column key={p.name} horizontalAlignment="center">
            <Text color={i === props.nextIndex ? c.accent : c.muted} style={{ fontSize: 11 }}>{p.name}</Text>
            <Text color={i === props.nextIndex ? c.accent : c.fg} style={{ fontSize: 13, fontWeight: 'bold' }}>{p.time}</Text>
          </Column>
        ))}
      </Row>
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
  const c = palettes[props.style ?? (env.colorScheme === 'dark' ? 'dark' : 'cream')] ?? palettes.cream;
  return (
    <Column modifiers={[fillMaxSize(), background(c.bg), cornerRadius(24), paddingAll(14)]}>
      <Text color={c.muted} style={{ fontSize: 12, fontWeight: 'bold' }}>آية اليوم</Text>
      <Text color={c.fg} maxLines={6} style={{ fontSize: 15 }}>{props.ayah.text}</Text>
      <Spacer />
      <Text color={c.muted} style={{ fontSize: 11 }}>{props.ayah.ref}</Text>
    </Column>
  );
};

const DateWidgetView = (props: DateWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const palettes = {
    green: { bg: '#2F4529', fg: '#FFFFFF', muted: '#C9D8C0', accent: '#C5E08A' },
    cream: { bg: '#FBFAF5', fg: '#1F2A1C', muted: '#6B756A', accent: '#5A6E51' },
    dark: { bg: '#141A13', fg: '#ECEFE6', muted: '#A8B2A3', accent: '#A8C29B' },
  };
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
  const c = palettes[props.style ?? (env.colorScheme === 'dark' ? 'dark' : 'green')] ?? palettes.green;
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

export const PrayerWidget = createWidget<PrayerWidgetProps>('PrayerWidget', PrayerWidgetView) as unknown as WidgetHandle<PrayerWidgetProps>;
export const DailyWidget = createWidget<DailyWidgetProps>('DailyWidget', DailyWidgetView) as unknown as WidgetHandle<DailyWidgetProps>;
export const DateWidget = createWidget<DateWidgetProps>('DateWidget', DateWidgetView) as unknown as WidgetHandle<DateWidgetProps>;
export const KhatmaWidget = createWidget<KhatmaWidgetProps>('KhatmaWidget', KhatmaWidgetView) as unknown as WidgetHandle<KhatmaWidgetProps>;
export const widgetsAvailable = true;
export const supportsTimeline = false;
