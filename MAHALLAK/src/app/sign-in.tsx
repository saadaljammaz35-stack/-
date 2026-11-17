import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { isBackendConfigured, isGoogleConfigured } from '@/config/env';
import { Banner, Button, Field, GlassCard, GlassSurface, Txt } from '@/design/Glass';
import { GoogleMark } from '@/design/Icon';
import { Logo } from '@/design/Logo';
import { useTheme } from '@/design/theme';
import { fonts, radius, space, type } from '@/design/tokens';
import {
  AuthError,
  isAppleSignInAvailable,
  sendPhoneCode,
  signInWithApple,
  signInWithGoogle,
  verifyPhoneCode,
} from '@/services/auth/authService';
import { useApp } from '@/state/appStore';

export default function SignIn() {
  const { t } = useTranslation();
  const { isDark, c } = useTheme();
  const [apple, setApple] = useState(false);
  const [phoneMode, setPhoneMode] = useState(false);
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const backend = isBackendConfigured();

  useEffect(() => {
    void isAppleSignInAvailable().then(setApple);
  }, []);

  const done = () => {
    void useApp.getState().updateSettings({ guest: false });
    router.replace('/home');
  };

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const code = e instanceof AuthError ? e.code : 'unknown';
      if (code !== 'cancelled') setError(t(`signIn.errors.${code}`));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen testID="sign-in" contentStyle={{ paddingTop: space.xl, gap: space.md }}>
      <View style={{ alignItems: 'center', gap: space.xs, marginBottom: space.md }}>
        <Logo size={92} />
        <Txt variant="title" align="center" style={{ marginTop: space.sm }}>
          {t('signIn.title')}
        </Txt>
        <Txt tone="secondary" align="center">
          {t('signIn.subtitle')}
        </Txt>
      </View>

      {!backend ? <Banner tone="warning" icon="cloud" text={t('signIn.errors.backend_not_configured')} /> : null}
      {error ? <Banner tone="danger" icon="close" text={error} /> : null}

      <GlassCard padding={space.lg} radius={radius.xl}>
        <View style={{ gap: space.sm }}>
          {apple ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.pill}
              style={{ height: 52, width: '100%', opacity: backend ? 1 : 0.45 }}
              onPress={() => backend && void run('apple', async () => (await signInWithApple(), done()))}
            />
          ) : null}

          {Platform.OS !== 'web' || isGoogleConfigured() ? (
            <Pressable
              testID="sign-in-google"
              accessibilityRole="button"
              accessibilityLabel={t('signIn.google')}
              disabled={!backend || busy !== null}
              onPress={() => void run('google', async () => (await signInWithGoogle(), done()))}
              style={({ pressed }) => ({ opacity: !backend ? 0.45 : pressed ? 0.8 : 1 })}
            >
              <GlassSurface weight="thick" radius={radius.pill} style={styles.google}>
                <GoogleMark size={20} />
                <Txt variant="callout" style={{ fontFamily: fonts.semibold }}>
                  {t('signIn.google')}
                </Txt>
              </GlassSurface>
            </Pressable>
          ) : null}

          {!phoneMode ? (
            <Button
              kind="glass"
              icon="phone"
              title={t('signIn.phone')}
              onPress={() => setPhoneMode(true)}
              disabled={!backend}
              testID="sign-in-phone"
            />
          ) : sentTo === null ? (
            <View style={{ gap: space.sm }}>
              <Field
                label={t('signIn.phoneLabel')}
                icon="phone"
                value={phone}
                onChangeText={setPhone}
                placeholder={t('signIn.phonePlaceholder')}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                testID="phone-input"
                style={{ writingDirection: 'ltr' }}
              />
              <Button
                title={t('signIn.sendCode')}
                loading={busy === 'send'}
                onPress={() => void run('send', async () => setSentTo(await sendPhoneCode(phone)))}
                testID="phone-send"
              />
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              <Txt variant="caption" tone="secondary">
                {t('signIn.codeSentTo', { phone: sentTo })}
              </Txt>
              <Field
                label={t('signIn.codeLabel')}
                icon="lock"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={8}
                testID="otp-input"
                style={{ writingDirection: 'ltr', letterSpacing: 6 }}
              />
              <Button
                title={t('signIn.verify')}
                loading={busy === 'verify'}
                onPress={() => void run('verify', async () => (await verifyPhoneCode(sentTo, code), done()))}
                testID="otp-verify"
              />
              <View style={styles.inline}>
                <Button kind="ghost" title={t('signIn.resend')} onPress={() => void run('send', async () => setSentTo(await sendPhoneCode(sentTo)))} />
                <Button kind="ghost" title={t('signIn.changeNumber')} onPress={() => (setSentTo(null), setCode(''))} />
              </View>
            </View>
          )}
        </View>
      </GlassCard>

      <View style={styles.or}>
        <View style={[styles.line, { backgroundColor: c.hairline }]} />
        <Txt variant="caption" tone="tertiary">
          {t('signIn.or')}
        </Txt>
        <View style={[styles.line, { backgroundColor: c.hairline }]} />
      </View>

      <Button
        kind="glass"
        title={t('signIn.guest')}
        onPress={() => {
          void useApp.getState().updateSettings({ guest: true });
          router.replace('/home');
        }}
        testID="sign-in-guest"
      />
      <Txt variant="caption" tone="tertiary" align="center">
        {t('signIn.guestNote')}
      </Txt>
      <Txt variant="micro" tone="tertiary" align="center" style={{ marginTop: space.md, ...type.micro }}>
        {t('signIn.terms')}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  google: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  inline: { flexDirection: 'row', justifyContent: 'space-between' },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
});
