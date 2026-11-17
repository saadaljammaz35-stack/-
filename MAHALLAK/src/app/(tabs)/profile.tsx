import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Banner, Button, Divider, GlassCard, Row, Txt } from '@/design/Glass';
import { Icon } from '@/design/Icon';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { relativeTime, type Lang } from '@/i18n';
import { signOut } from '@/services/auth/authService';
import { useApp } from '@/state/appStore';

function confirm(title: string, body: string, ok: string, cancel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n${body}`) ?? true);
  return new Promise((resolve) =>
    Alert.alert(title, body, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { c } = useTheme();
  const session = useApp((s) => s.session);
  const fullAccess = useApp((s) => s.fullAccess);
  const settings = useApp((s) => s.settings);
  const syncing = useApp((s) => s.syncing);
  const lastSyncAt = useApp((s) => s.lastSyncAt);
  const lastSync = useApp((s) => s.lastSync);
  const items = useApp((s) => s.items);
  const [msg, setMsg] = useState<string | null>(null);

  const user = session?.user;
  const display =
    (user?.user_metadata?.full_name as string | undefined) || user?.email || user?.phone || (user ? '—' : t('profile.guest'));

  return (
    <Screen title={t('profile.title')} tabBar testID="profile">
      <GlassCard padding={space.lg} radius={radius.xl}>
        <View style={styles.account}>
          <View style={[styles.avatar, { backgroundColor: c.primary }]}>
            <Icon name="user" size={30} color={c.onPrimary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="headline" numberOfLines={1} testID="profile-name">
              {display}
            </Txt>
            <Txt variant="caption" tone="secondary">
              {user ? t('common.items', { count: items.length }) : t('profile.guestBody')}
            </Txt>
          </View>
        </View>
        {!user ? <Button title={t('profile.signIn')} onPress={() => router.push('/sign-in')} style={{ marginTop: space.md }} testID="profile-sign-in" /> : null}
      </GlassCard>

      <GlassCard padding={space.lg} onPress={() => router.push('/purchase')} testID="profile-plan">
        <View style={styles.account}>
          <Icon name="sparkle" size={26} color={c.accentText} />
          <View style={{ flex: 1 }}>
            <Txt variant="headline">{fullAccess ? t('profile.full') : t('profile.free')}</Txt>
            {!fullAccess ? (
              <Txt variant="caption" tone="accent">
                {t('profile.upgrade')}
              </Txt>
            ) : null}
          </View>
          <Icon name="chevron" size={18} color={c.textTertiary} />
        </View>
      </GlassCard>

      {user ? (
        <GlassCard padding={space.lg}>
          <View style={styles.account}>
            <Icon name="cloud" size={24} color={c.text} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{t('profile.sync')}</Txt>
              <Txt variant="caption" tone="secondary">
                {!settings.cloudSync
                  ? t('profile.syncOff')
                  : syncing
                    ? t('profile.syncing')
                    : lastSyncAt
                      ? t('profile.lastSync', { when: relativeTime(lastSyncAt, i18n.language as Lang) })
                      : ''}
              </Txt>
            </View>
            {settings.cloudSync ? (
              <Button
                kind="glass"
                title={t('profile.syncNow')}
                loading={syncing}
                onPress={async () => {
                  const r = await useApp.getState().syncNow();
                  setMsg(r && r.failed > 0 ? t('profile.syncFailed', { count: r.failed }) : null);
                }}
                testID="profile-sync"
              />
            ) : null}
          </View>
          {msg || (lastSync && lastSync.failed > 0) ? <Banner tone="warning" text={msg ?? t('profile.syncFailed', { count: lastSync?.failed ?? 0 })} /> : null}
        </GlassCard>
      ) : null}

      <GlassCard padding={space.md}>
        <Row icon="sliders" title={t('profile.settings')} onPress={() => router.push('/settings')} testID="profile-settings" />
        <Divider />
        <Row icon="shield" title={t('profile.privacy')} onPress={() => router.push('/privacy')} testID="profile-privacy" />
        <Divider />
        <Row icon="sparkle" title={t('profile.purchase')} onPress={() => router.push('/purchase')} />
        {user ? (
          <>
            <Divider />
            <Row
              icon="logout"
              title={t('profile.signOut')}
              danger
              testID="profile-sign-out"
              onPress={async () => {
                if (await confirm(t('profile.signOutTitle'), t('profile.signOutBody'), t('profile.signOut'), t('common.cancel'))) {
                  await signOut();
                  await useApp.getState().updateSettings({ guest: true });
                }
              }}
            />
          </>
        ) : null}
      </GlassCard>

      <Txt variant="caption" tone="tertiary" align="center">
        {t('profile.version', { v: Constants.expoConfig?.version ?? '1.0.0' })}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
