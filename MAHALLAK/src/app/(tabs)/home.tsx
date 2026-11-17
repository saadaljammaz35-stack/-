import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ItemImage } from '@/components/ItemImage';
import { ItemTile } from '@/components/ItemCard';
import { Screen } from '@/components/Screen';
import { Banner, Button, EmptyState, Field, GlassCard, IconButton, SectionTitle, Txt } from '@/design/Glass';
import { Icon } from '@/design/Icon';
import { LogoMark } from '@/design/Logo';
import { MicOrb } from '@/design/MicOrb';
import { useTheme } from '@/design/theme';
import { fonts, radius, space } from '@/design/tokens';
import type { Place } from '@/domain/models';
import { useApp } from '@/state/appStore';
import { useDraft } from '@/state/draft';

export default function Home() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const items = useApp((s) => s.items);
  const places = useApp((s) => s.places);
  const images = useApp((s) => s.images);
  const session = useApp((s) => s.session);
  const online = useApp((s) => s.online);
  const [query, setQuery] = useState('');

  const byPlace = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const recent = useMemo(
    () => [...items].sort((a, b) => Date.parse(b.lastMovedAt ?? b.createdAt) - Date.parse(a.lastMovedAt ?? a.createdAt)).slice(0, 10),
    [items],
  );
  const favorites = useMemo(() => items.filter((i) => i.favorite).slice(0, 10), [items]);
  const recentPlaces = useMemo(() => {
    const seen = new Map<string, { place: Place; count: number; last: number }>();
    for (const it of items) {
      const p = it.currentLocationId ? byPlace.get(it.currentLocationId) : undefined;
      if (!p) continue;
      const e = seen.get(p.id) ?? { place: p, count: 0, last: 0 };
      e.count++;
      e.last = Math.max(e.last, Date.parse(it.lastMovedAt ?? it.createdAt));
      seen.set(p.id, e);
    }
    return [...seen.values()].sort((a, b) => b.last - a.last).slice(0, 6);
  }, [items, byPlace]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.morning') : t('home.evening');
  const name = (session?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0];

  const startAdd = () => {
    useDraft.getState().start('create');
    router.push('/add/item');
  };

  return (
    <Screen tabBar testID="home">
      <View style={styles.top}>
        <View style={styles.brand}>
          <LogoMark size={40} />
          <Txt variant="headline" style={{ fontFamily: fonts.bold }}>
            {t('common.appName')}
          </Txt>
        </View>
        <IconButton name="plus" label={t('home.addItem')} onPress={startAdd} testID="home-add-icon" />
      </View>

      {!online ? <Banner tone="warning" icon="cloud" text={t('common.offline')} /> : null}

      <View style={{ marginTop: space.sm }}>
        <Txt variant="callout" tone="secondary">
          {name ? t('home.greetingName', { greeting, name }) : greeting}
        </Txt>
        <Txt variant="display" testID="home-question">
          {t('home.question')}
        </Txt>
      </View>

      <View style={styles.orb}>
        <MicOrb size={150} listening={false} onPress={() => router.push('/voice?listen=1')} label={t('tabs.voice')} testID="home-mic" />
        <Txt variant="caption" tone="secondary" style={{ marginTop: -14 }}>
          {t('home.micHint')}
        </Txt>
      </View>

      <Field
        icon="search"
        placeholder={t('home.searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        onSubmitEditing={() => query.trim() && router.push({ pathname: '/voice', params: { q: query.trim() } })}
        testID="home-search"
      />

      <View style={styles.actions}>
        <Button title={t('home.addItem')} icon="camera" onPress={startAdd} style={{ flex: 1 }} testID="home-add" />
        <Button title={t('home.roomScan')} icon="scan" kind="glass" onPress={() => router.push('/room-scan')} style={{ flex: 1 }} testID="home-room-scan" />
      </View>
      <Button title={t('home.imageSearch')} icon="image" kind="ghost" onPress={() => router.push('/voice?mode=image')} testID="home-image-search" />

      <GlassCard padding={space.lg}>
        <View style={styles.stats}>
          <View style={{ flex: 1 }}>
            <Txt variant="caption" tone="secondary">
              {t('home.registered')}
            </Txt>
            <Txt variant="display" testID="home-count">
              {String(items.length)}
            </Txt>
          </View>
          <View style={[styles.statDivider, { backgroundColor: c.hairline }]} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Icon name="pin" size={22} color={c.accentText} />
            <Txt variant="callout" tone="secondary">
              {t('common.places', { count: places.length })}
            </Txt>
          </View>
        </View>
      </GlassCard>

      {items.length === 0 ? (
        <EmptyState icon="box" title={t('home.emptyTitle')} body={t('home.emptyBody')} action={t('home.addItem')} onAction={startAdd} />
      ) : (
        <>
          <SectionTitle title={t('home.recentItems')} action={t('common.seeAll')} onAction={() => router.push('/items')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
            {recent.map((it) => (
              <ItemTile key={it.id} item={it} place={it.currentLocationId ? (byPlace.get(it.currentLocationId) ?? null) : null} width={150} />
            ))}
          </ScrollView>

          {recentPlaces.length > 0 ? (
            <>
              <SectionTitle title={t('home.recentPlaces')} />
              <View style={{ gap: space.xs }}>
                {recentPlaces.map(({ place, count }) => (
                  <GlassCard
                    key={place.id}
                    padding={10}
                    radius={radius.md}
                    onPress={() => router.push({ pathname: '/voice', params: { q: `وش في ${place.spot}` } })}
                    accessibilityLabel={place.spot}
                  >
                    <View style={styles.placeRow}>
                      <ItemImage image={place.imageId ? images[place.imageId] : null} size={52} radius={radius.sm} placeholderIcon="pin" />
                      <View style={{ flex: 1 }}>
                        <Txt variant="bodyStrong" numberOfLines={1}>
                          {place.spot}
                        </Txt>
                        <Txt variant="caption" tone="secondary">
                          {(place.roomLabel || t(`rooms.${place.room}`)) + ' · ' + t('common.items', { count })}
                        </Txt>
                      </View>
                      <Icon name="chevron" size={18} color={c.textTertiary} />
                    </View>
                  </GlassCard>
                ))}
              </View>
            </>
          ) : null}

          {favorites.length > 0 ? (
            <>
              <SectionTitle title={t('home.favorites')} action={t('common.seeAll')} onAction={() => router.push('/favorites')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
                {favorites.map((it) => (
                  <ItemTile key={it.id} item={it} place={it.currentLocationId ? (byPlace.get(it.currentLocationId) ?? null) : null} width={150} />
                ))}
              </ScrollView>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orb: { alignItems: 'center', marginVertical: -space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  stats: { flexDirection: 'row', alignItems: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth * 2, alignSelf: 'stretch', marginHorizontal: space.md },
  hscroll: { gap: space.sm, paddingVertical: 4, paddingHorizontal: 2 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
