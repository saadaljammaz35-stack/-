import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { PLAN } from '@/config/plans';
import { Banner, Button, GlassCard, Txt, haptic } from '@/design/Glass';
import { Icon } from '@/design/Icon';
import { LogoMark } from '@/design/Logo';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { PurchaseError, isStoreConfigured, loadOffer, purchase, restore, type StoreOffer } from '@/services/purchase/purchaseService';
import { useApp } from '@/state/appStore';

export default function Purchase() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const fullAccess = useApp((s) => s.fullAccess);
  const [offer, setOffer] = useState<StoreOffer | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'unconfigured'>('loading');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !isStoreConfigured()) {
      setState('unconfigured');
      return;
    }
    loadOffer()
      .then((o) => {
        setOffer(o);
        setState(o ? 'ready' : 'none');
      })
      .catch(() => setState('none'));
  }, []);

  const handle = async (kind: 'buy' | 'restore') => {
    setBusy(kind);
    setMsg(null);
    try {
      const ok = kind === 'buy' && offer ? await purchase(offer) : await restore();
      await useApp.getState().refreshEntitlement();
      if (ok) {
        haptic('success');
        setMsg({ tone: 'success', text: t('purchase.thanks') });
      } else if (kind === 'restore') setMsg({ tone: 'warning', text: t('purchase.restoreNone') });
    } catch (e) {
      const code = e instanceof PurchaseError ? e.code : 'failed';
      if (code !== 'cancelled') setMsg({ tone: 'danger', text: t(`purchase.errors.${code}`) });
    } finally {
      setBusy(null);
    }
  };

  const features = [
    t('purchase.f1'),
    t('purchase.f2', { n: PLAN.full.aiRecognitionsPerMonth }),
    t('purchase.f3', { n: PLAN.full.roomScansPerMonth }),
    t('purchase.f4', { gb: PLAN.full.cloudStorageMb / 1024 }),
    t('purchase.f5'),
  ];

  return (
    <Screen back testID="purchase">
      <View style={{ alignItems: 'center', gap: space.xs }}>
        <LogoMark size={84} />
        <Txt variant="display" align="center">
          {t('purchase.title')}
        </Txt>
        <Txt tone="secondary" align="center">
          {t('purchase.subtitle')}
        </Txt>
      </View>
      <GlassCard padding={space.lg} radius={radius.xl}>
        <View style={{ gap: space.sm }}>
          {features.map((f) => (
            <View key={f} style={styles.feature}>
              <View style={[styles.tick, { backgroundColor: c.primary }]}>
                <Icon name="check" size={14} color={c.onPrimary} strokeWidth={2.6} />
              </View>
              <Txt style={{ flex: 1 }}>{f}</Txt>
            </View>
          ))}
        </View>
      </GlassCard>
      <Txt variant="caption" tone="tertiary">
        {t('purchase.fairUse')}
      </Txt>
      {msg ? <Banner tone={msg.tone} text={msg.text} /> : null}
      {fullAccess ? (
        <Banner tone="success" icon="check" text={t('purchase.owned')} />
      ) : state === 'unconfigured' ? (
        <Banner tone="warning" icon="lock" text={Platform.OS === 'web' ? t('purchase.webUnavailable') : t('purchase.notConfigured')} />
      ) : state === 'none' ? (
        <Banner tone="warning" text={t('purchase.noOffer')} />
      ) : (
        <Button
          size="lg"
          title={offer ? t('purchase.buy', { price: offer.priceString }) : t('common.loading')}
          disabled={!offer}
          loading={busy === 'buy'}
          onPress={() => void handle('buy')}
          testID="purchase-buy"
        />
      )}
      {state !== 'unconfigured' ? (
        <Button kind="glass" title={t('purchase.restore')} loading={busy === 'restore'} onPress={() => void handle('restore')} testID="purchase-restore" />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tick: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
