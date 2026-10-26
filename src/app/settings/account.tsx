import { CloudDownload, LogOut, Mail, RefreshCw, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { confirmAsync } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Button, Card, Txt } from '@/components/ui';
import { deleteAccount, loadSession, sendCode, signOut, syncAvailable, syncNow, useSync, verifyCode } from '@/features/sync';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

function Field(props: { value: string; onChangeText: (v: string) => void; placeholder: string; keyboardType?: 'email-address' | 'number-pad'; maxLength?: number }) {
  const t = useTheme();
  return (
    <TextInput
      {...props}
      autoCapitalize="none"
      autoCorrect={false}
      placeholderTextColor={t.colors.textFaint}
      style={{ backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: t.fonts.regular, fontSize: t.fs(16), color: t.colors.text, textAlign: 'left', writingDirection: 'ltr' }}
    />
  );
}

export default function AccountScreen() {
  const { tr } = useI18n();
  const { session, lastSync, busy, error } = useSync();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSession().catch(() => undefined);
  }, []);

  const attempt = async (fn: () => Promise<void>) => {
    setWorking(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  if (!syncAvailable) {
    return (
      <Screen title={tr('الحساب والمزامنة', 'Account & sync')}>
        <Card>
          <Txt>{tr('المزامنة غير مفعّلة في هذا الإصدار. بياناتك محفوظة على جهازك ويمكنك نقلها بالنسخ الاحتياطي.', 'Sync is not enabled in this build. Your data is on your device and you can move it with a backup.')}</Txt>
        </Card>
      </Screen>
    );
  }

  if (!session) {
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    return (
      <Screen title={tr('الحساب والمزامنة', 'Account & sync')}>
        <Card style={{ gap: 8 }}>
          <Txt weight="semibold">{tr('الحساب اختياري', 'An account is optional')}</Txt>
          <Txt muted>
            {tr(
              'سجّل الدخول ببريدك لمزامنة الختمات والمفضلة والإعدادات بين أجهزتك. لا كلمة مرور: نرسل لك رمزًا مؤقتًا.',
              'Sign in with your email to sync khatmas, favourites and settings across devices. No password: we email you a one-time code.',
            )}
          </Txt>
        </Card>
        {step === 'email' ? (
          <>
            <Field value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" />
            <Button
              title={tr('إرسال الرمز', 'Send code')}
              icon={Mail}
              loading={working}
              disabled={!validEmail}
              onPress={() =>
                attempt(async () => {
                  await sendCode(email.trim());
                  setStep('code');
                })
              }
            />
          </>
        ) : (
          <>
            <Txt muted>{tr(`أدخل الرمز المرسل إلى ${email.trim()}`, `Enter the code sent to ${email.trim()}`)}</Txt>
            <Field value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} placeholder="123456" keyboardType="number-pad" maxLength={10} />
            <Button
              title={tr('تأكيد', 'Verify')}
              loading={working}
              disabled={code.length < 6}
              onPress={() =>
                attempt(async () => {
                  await verifyCode(email.trim(), code);
                  await syncNow();
                })
              }
            />
            <Button title={tr('تغيير البريد', 'Change email')} tone="plain" onPress={() => (setStep('email'), setCode(''))} />
          </>
        )}
        {message ? (
          <Card tone="soft">
            <Txt>{message}</Txt>
          </Card>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen title={tr('الحساب والمزامنة', 'Account & sync')}>
      <Card style={{ gap: 6 }}>
        <Txt variant="caption" muted>
          {tr('مسجّل الدخول بـ', 'Signed in as')}
        </Txt>
        <Txt weight="semibold">{session.user.email ?? ''}</Txt>
        <Txt variant="caption" muted>
          {lastSync ? tr(`آخر مزامنة: ${new Date(lastSync).toLocaleString()}`, `Last sync: ${new Date(lastSync).toLocaleString()}`) : tr('لم تتم المزامنة بعد', 'Not synced yet')}
        </Txt>
      </Card>
      <Button title={tr('مزامنة الآن', 'Sync now')} icon={RefreshCw} loading={busy} onPress={() => syncNow()} />
      {error ? (
        <Card tone="soft">
          <Txt>{tr(`تعذّرت المزامنة: ${error}`, `Sync failed: ${error}`)}</Txt>
        </Card>
      ) : null}
      <Txt variant="caption" muted>
        {tr('تتم المزامنة تلقائيًا عند فتح التطبيق. عند اختلاف البيانات بين جهازين تُعتمد النسخة الأحدث لكل قسم.', 'Sync runs automatically when the app opens. When two devices differ, the newer copy of each section wins.')}
      </Txt>
      <View style={{ gap: 10, marginTop: 8 }}>
        <Button title={tr('تسجيل الخروج', 'Sign out')} icon={LogOut} tone="soft" onPress={() => attempt(signOut)} />
        <Button
          title={tr('حذف الحساب وبياناته من السحابة', 'Delete account & cloud data')}
          icon={Trash2}
          tone="danger"
          loading={working}
          onPress={async () => {
            const ok = await confirmAsync(
              tr('حذف الحساب؟', 'Delete account?'),
              tr('سيُحذف حسابك ونسختك السحابية نهائيًا. تبقى البيانات المحفوظة على هذا الجهاز.', 'Your account and cloud copy are permanently deleted. Data on this device stays.'),
              tr('حذف', 'Delete'),
              tr('إلغاء', 'Cancel'),
            );
            if (ok) attempt(deleteAccount);
          }}
        />
      </View>
      {message ? (
        <Card tone="soft">
          <Txt>{message}</Txt>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.7 }}>
        <CloudDownload size={14} />
        <Txt variant="caption" muted>
          {tr('لا تُرفع التلاوات وكتب الحديث المحمّلة؛ تُحمَّل على كل جهاز.', 'Downloaded recitations and hadith books are not uploaded; download them on each device.')}
        </Txt>
      </View>
    </Screen>
  );
}
