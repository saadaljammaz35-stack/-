import { router } from 'expo-router';
import { HardDriveDownload, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { confirmAsync } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Button, Card, Txt } from '@/components/ui';
import { clearUserContent } from '@/data/db';
import { deleteAllDownloads, downloadedBytes, downloadsSupported } from '@/features/audio/downloads';
import { deleteAllLocalData } from '@/features/backup';
import { ensureBundledBooks } from '@/features/hadith/books';
import { rescheduleNotifications } from '@/features/notifications';
import { signOut, syncAvailable, useSync } from '@/features/sync';
import { useI18n } from '@/i18n';


function Para({ title, children }: { title: string; children: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Txt weight="semibold">{title}</Txt>
      <Txt muted>{children}</Txt>
    </View>
  );
}

export default function PrivacyScreen() {
  const { tr } = useI18n();
  const session = useSync((s) => s.session);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const mb = downloadsSupported ? Math.round(downloadedBytes() / 1e6) : 0;

  const run = async (id: string, title: string, message: string, action: () => Promise<void>, doneText: string) => {
    if (!(await confirmAsync(title, message, tr('حذف', 'Delete'), tr('إلغاء', 'Cancel')))) return;
    setBusy(id);
    setDone(null);
    try {
      await action();
      setDone(doneText);
    } catch (e) {
      setDone(tr(`حدث خطأ: ${(e as Error).message}`, `Error: ${(e as Error).message}`));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title={tr('الخصوصية وحذف البيانات', 'Privacy & data')}>
      <Card style={{ gap: 14 }}>
        <Para title={tr('بياناتك على جهازك', 'Your data stays on your device')}>
          {tr(
            'الإعدادات والختمات والمفضلة وتقدم الأذكار تُحفظ على جهازك فقط. لا يوجد في التطبيق إعلانات ولا أدوات تتبّع أو تحليلات.',
            'Settings, khatmas, favourites and adhkar progress are stored only on your device. The app has no ads, trackers or analytics.',
          )}
        </Para>
        <Para title={tr('الموقع', 'Location')}>
          {tr(
            'يُستخدم موقعك لحساب مواقيت الصلاة واتجاه القبلة على الجهاز نفسه، ولا يُرسل إلى أي خادم. يمكنك اختيار المدينة يدويًا بدلًا من ذلك.',
            'Your location is used on the device to compute prayer times and the Qibla, and is never sent to a server. You can pick a city manually instead.',
          )}
        </Para>
        <Para title={tr('الاتصال بالإنترنت', 'Network requests')}>
          {tr(
            'يتصل التطبيق فقط عند طلبك: تلاوات وتفاسير وترجمات من Quran.com، كتب الحديث من مستودع hadith-api مع التحقق من سلامتها، البث المباشر من يوتيوب، وروابط الفتاوى من مواقعها الرسمية.',
            'The app connects only when you ask: recitations, tafsir and translations from Quran.com, hadith books from the hadith-api repository (integrity-checked), live streams from YouTube, and fatwa links on the official sites.',
          )}
        </Para>
        {syncAvailable ? (
          <Para title={tr('الحساب (اختياري)', 'Account (optional)')}>
            {tr(
              'عند تفعيل المزامنة يُحفظ بريدك الإلكتروني ونسخة من بياناتك في قاعدة بيانات محمية لا يصل إليها غيرك، ويمكنك حذف الحساب وكل بياناته في أي وقت.',
              'If you turn on sync, your email and a copy of your data are stored in a protected database only you can access. You can delete the account and all its data at any time.',
            )}
          </Para>
        ) : null}
      </Card>

      {downloadsSupported ? (
        <Button
          title={tr(`حذف التلاوات المحمّلة (${mb} م.ب)`, `Delete downloaded recitations (${mb} MB)`)}
          icon={HardDriveDownload}
          tone="soft"
          loading={busy === 'audio'}
          disabled={busy !== null || mb === 0}
          onPress={() =>
            run('audio', tr('حذف التلاوات المحمّلة؟', 'Delete downloaded recitations?'), tr('يمكنك تحميلها مجددًا لاحقًا.', 'You can download them again later.'), async () => deleteAllDownloads(), tr('تم حذف التلاوات المحمّلة.', 'Downloads deleted.'))
          }
        />
      ) : null}

      <Button
        title={tr('حذف كتب الحديث والملفات المؤقتة', 'Delete hadith books & cache')}
        icon={HardDriveDownload}
        tone="soft"
        loading={busy === 'cache'}
        disabled={busy !== null}
        onPress={() =>
          run(
            'cache',
            tr('حذف كتب الحديث المحمّلة؟', 'Delete downloaded hadith books?'),
            tr('ستُحذف الكتب المحمّلة والتفاسير والترجمات المخزنة مؤقتًا. تبقى الأربعون النووية والقدسية لأنها مضمّنة في التطبيق.', 'Downloaded books and cached tafsir/translations are removed. Al-Nawawi’s Forty and the Qudsi hadiths stay because they ship with the app.'),
            async () => {
              await clearUserContent();
              await ensureBundledBooks();
            },
            tr('تم الحذف.', 'Deleted.'),
          )
        }
      />

      <Button
        title={tr('حذف كل بياناتي من هذا الجهاز', 'Delete all my data on this device')}
        icon={Trash2}
        tone="danger"
        loading={busy === 'all'}
        disabled={busy !== null}
        onPress={() =>
          run(
            'all',
            tr('حذف كل البيانات؟', 'Delete all data?'),
            tr('ستُحذف الإعدادات والختمات والمفضلة والمسبحة وتقدم الأذكار والتلاوات المحمّلة وكتب الحديث من هذا الجهاز، ويُسجَّل خروجك إن كنت مسجّلًا (تبقى نسختك السحابية). لا يمكن التراجع. أنشئ نسخة احتياطية أولًا إن أردت.', 'Settings, khatmas, favourites, tasbih, adhkar progress, downloaded recitations and hadith books on this device will be deleted, and you will be signed out (your cloud copy stays). This cannot be undone. Create a backup first if you need one.'),
            async () => {
              deleteAllDownloads();
              await clearUserContent();
              await ensureBundledBooks();
              // Sign out first so the emptied device never overwrites the cloud copy.
              if (useSync.getState().session) await signOut();
              await deleteAllLocalData();
              await rescheduleNotifications({ force: true });
            },
            tr('تم حذف كل البيانات المحلية.', 'All local data deleted.'),
          )
        }
      />
      {syncAvailable && session ? (
        <Button title={tr('حذف الحساب وبياناته من السحابة', 'Delete account & cloud data')} icon={Trash2} tone="plain" onPress={() => router.push('/settings/account')} />
      ) : null}
      {done ? (
        <Card tone="soft">
          <Txt>{done}</Txt>
        </Card>
      ) : null}
    </Screen>
  );
}
