import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ItemImage } from '@/components/ItemImage';
import { Screen } from '@/components/Screen';
import { EmptyState, GlassCard, Txt } from '@/design/Glass';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import type { PlacementEvent } from '@/domain/models';
import { formatDate, relativeTime, type Lang } from '@/i18n';
import { useApp } from '@/state/appStore';
import { getItemService } from '@/state/services';

export default function History() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { c } = useTheme();
  const item = useApp((s) => s.items.find((i) => i.id === id));
  const images = useApp((s) => s.images);
  const [events, setEvents] = useState<PlacementEvent[] | null>(null);
  const version = useApp((s) => s.items);

  useEffect(() => {
    void getItemService().history(id).then(setEvents);
  }, [id, version]);

  return (
    <Screen back title={t('history.title')} testID="history">
      {item ? (
        <Txt variant="headline" tone="secondary">
          {item.name}
        </Txt>
      ) : null}
      {events && events.length === 0 ? <EmptyState icon="history" title={t('history.empty')} body="" /> : null}
      {events?.map((e, k) => (
        <View key={e.id} style={styles.row} testID={`history-${k}`}>
          <View style={styles.rail}>
            <View style={[styles.dot, { backgroundColor: k === 0 ? c.accent : c.hairline, borderColor: c.accent }]} />
            {k < events.length - 1 ? <View style={[styles.line, { backgroundColor: c.hairline }]} /> : null}
          </View>
          <GlassCard padding={12} style={{ flex: 1 }} weight={k === 0 ? 'regular' : 'thin'}>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <ItemImage image={e.imageId ? images[e.imageId] : null} size={64} radius={radius.sm} placeholderIcon="pin" />
              <View style={{ flex: 1, gap: 2 }}>
                {k === 0 ? (
                  <Txt variant="micro" tone="accent">
                    {t('history.current')}
                  </Txt>
                ) : null}
                <Txt variant="bodyStrong" numberOfLines={2}>
                  {(e.roomLabel || t(`rooms.${e.room}`)) + ' · ' + e.spot}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {t('history.placed', { when: relativeTime(e.placedAt, i18n.language as Lang) })}
                </Txt>
                <Txt variant="caption" tone="tertiary">
                  {formatDate(e.placedAt, i18n.language as Lang)}
                </Txt>
              </View>
            </View>
          </GlassCard>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  rail: { width: 18, alignItems: 'center', paddingTop: 22 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  line: { flex: 1, width: 2, marginTop: 4 },
});
