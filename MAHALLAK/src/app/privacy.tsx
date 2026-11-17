import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { env } from '@/config/env';
import { Banner, Divider, GlassCard, Row, Txt } from '@/design/Glass';
import { space } from '@/design/tokens';
import { deleteAccountEverywhere, eraseThisDevice } from '@/services/account/deleteAccount';
import { shareExport } from '@/services/account/exportData';
import { useApp } from '@/state/appStore';
import { getItemService } from '@/state/services';

function ask(title: string, body: string, ok: string, cancel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(Boolean(globalThis.confirm?.(`${title}\n${body}`)));
  return new Promise((resolve) =>
    Alert.alert(title, body, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function Privacy() {
  const { t } = useTranslation();
  const s = useApp((st) => st.settings);
  const session = useApp((st) => st.session);
  const update = useApp((st) => st.updateSettings);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const signedIn = Boolean(session);

  const run = async (key: string, fn: () => Promise<void>, done?: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg({ tone: 'success', text: done });
    } catch {
      setMsg({ tone: 'danger', text: t('common.error') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen back title={t('privacy.title')} testID="privacy">
      <Banner icon="shield" text={t('privacy.intro')} />
      {msg ? <Banner tone={msg.tone} icon={msg.tone === 'success' ? 'check' : 'close'} text={msg.text} /> : null}

      <GlassCard padding={space.md}>
        <Row
          icon="cloud"
          title={t('privacy.cloudSync')}
          subtitle={signedIn ? t('privacy.cloudSyncHint') : t('privacy.requiresAccount')}
          right={
            <Toggle
              testID="toggle-cloud-sync"
              value={s.cloudSync}
              disabled={!signedIn}
              onChange={(v) => {
                void update({ cloudSync: v, cloudPhotos: v ? s.cloudPhotos : false }).then(() => {
                  if (v) void useApp.getState().syncNow();
                });
              }}
            />
          }
        />
        <Divider />
        <Row
          icon="image"
          title={t('privacy.cloudPhotos')}
          subtitle={t('privacy.cloudPhotosHint')}
          right={<Toggle testID="toggle-cloud-photos" value={s.cloudPhotos} disabled={!signedIn || !s.cloudSync} onChange={(v) => void update({ cloudPhotos: v })} />}
        />
      </GlassCard>

      <GlassCard padding={space.md}>
        <Row
          icon="sparkle"
          title={t('privacy.aiConsent')}
          subtitle={signedIn ? t('privacy.aiConsentHint') : t('privacy.requiresAccount')}
          right={<Toggle testID="toggle-ai" value={s.aiConsent} disabled={!signedIn} onChange={(v) => void update({ aiConsent: v })} />}
        />
        <Divider />
        <Row
          icon="lock"
          title={t('privacy.aiTraining')}
          subtitle={t('privacy.aiTrainingHint')}
          right={<Toggle testID="toggle-training" value={s.aiTrainingConsent} onChange={(v) => void update({ aiTrainingConsent: v })} />}
        />
      </GlassCard>

      <GlassCard padding={space.md}>
        <Row
          icon="share"
          title={t('privacy.export')}
          subtitle={t('privacy.exportHint')}
          testID="privacy-export"
          onPress={() =>
            void run('export', async () => {
              await useApp.getState().syncNow();
              await shareExport(await getItemService().exportAll());
            })
          }
        />
        {env.privacyPolicyUrl ? (
          <>
            <Divider />
            <Row icon="doc" title={t('privacy.policy')} onPress={() => void WebBrowser.openBrowserAsync(env.privacyPolicyUrl)} />
          </>
        ) : null}
      </GlassCard>

      <GlassCard padding={space.md}>
        <Row
          icon="phone"
          title={t('privacy.eraseDevice')}
          subtitle={t('privacy.eraseDeviceBody')}
          danger
          onPress={async () => {
            if (await ask(t('privacy.deleteTitle'), t('privacy.eraseDeviceBody'), t('common.delete'), t('common.cancel'))) {
              await run('erase', eraseThisDevice, t('privacy.deleteDone'));
            }
          }}
        />
        {signedIn ? (
          <>
            <Divider />
            <Row
              icon="trash"
              title={t('privacy.deleteAccount')}
              subtitle={t('privacy.deleteAccountHint')}
              danger
              testID="privacy-delete-account"
              onPress={async () => {
                if (await ask(t('privacy.deleteTitle'), t('privacy.deleteBody'), t('common.delete'), t('common.cancel'))) {
                  await run('delete', async () => {
                    await deleteAccountEverywhere();
                    await update({ guest: false, cloudSync: false, cloudPhotos: false, aiConsent: false });
                    router.replace('/sign-in');
                  });
                }
              }}
            />
          </>
        ) : null}
      </GlassCard>
      {busy ? <Txt tone="secondary" align="center">{t('common.loading')}</Txt> : null}
      <View style={{ height: space.md }} />
    </Screen>
  );
}
