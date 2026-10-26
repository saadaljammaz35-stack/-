import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Download, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { Platform } from 'react-native';

import { confirmAsync } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Button, Card, Txt } from '@/components/ui';
import { createBackup, isBackup, restoreBackup, type Backup } from '@/features/backup';
import { useI18n } from '@/i18n';
import { useKhatmaStore, useQuranStore, useAdhkarStore, useHadithStore } from '@/store/user';

function fileName() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `ma-allah-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

async function exportBackup(): Promise<void> {
  const json = JSON.stringify(createBackup(), null, 2);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, fileName());
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'مع الله', UTI: 'public.json' });
}

async function pickBackup(): Promise<Backup | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  const text = Platform.OS === 'web' ? await (await fetch(asset.uri)).text() : await new File(asset.uri).text();
  const data = JSON.parse(text) as unknown;
  if (!isBackup(data)) throw new Error('not a backup');
  return data;
}


export default function BackupScreen() {
  const { tr } = useI18n();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const khatmas = useKhatmaStore((s) => s.khatmas.length);
  const bookmarks = useQuranStore((s) => s.bookmarks.length);
  const adhkarFav = useAdhkarStore((s) => s.favorites.length);
  const hadithFav = useHadithStore((s) => s.favorites.length);

  const onExport = async () => {
    setBusy('export');
    setMessage(null);
    try {
      await exportBackup();
    } catch (e) {
      setMessage(tr(`تعذّر إنشاء النسخة: ${(e as Error).message}`, `Backup failed: ${(e as Error).message}`));
    } finally {
      setBusy(null);
    }
  };

  const onImport = async () => {
    setBusy('import');
    setMessage(null);
    try {
      const backup = await pickBackup();
      if (!backup) return;
      const date = new Date(backup.createdAt).toLocaleString();
      const ok = await confirmAsync(
        tr('استعادة النسخة؟', 'Restore this backup?'),
        tr(`نسخة بتاريخ ${date}. ستحل محل بياناتك الحالية على هذا الجهاز.`, `Backup from ${date}. It replaces your current data on this device.`),
        tr('استعادة', 'Restore'),
        tr('إلغاء', 'Cancel'),
      );
      if (!ok) return;
      await restoreBackup(backup);
      setMessage(tr('تمت الاستعادة بنجاح.', 'Restored successfully.'));
    } catch (e) {
      setMessage(
        (e as Error).message === 'not a backup'
          ? tr('الملف المختار ليس نسخة احتياطية من «مع الله».', 'That file is not a «Ma Allah» backup.')
          : tr(`تعذّرت الاستعادة: ${(e as Error).message}`, `Restore failed: ${(e as Error).message}`),
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title={tr('النسخ الاحتياطي والاستعادة', 'Backup & restore')}>
      <Card style={{ gap: 6 }}>
        <Txt weight="semibold">{tr('ما الذي يُحفظ؟', 'What is saved?')}</Txt>
        <Txt muted>
          {tr(
            `الإعدادات والمدينة، موضع القراءة و${bookmarks} علامة، ${khatmas} ختمة، تقدم الأذكار و${adhkarFav + hadithFav} من المفضلة، المسبحة، سجل الصيام.`,
            `Settings and city, reading position and ${bookmarks} bookmarks, ${khatmas} khatmas, adhkar progress and ${adhkarFav + hadithFav} favourites, tasbih, fasting log.`,
          )}
        </Txt>
        <Txt variant="caption" muted>
          {tr('الملف بصيغة JSON ويبقى معك؛ لا يُرفع إلى أي خادم. التلاوات وكتب الحديث المحمّلة لا تدخل فيه ويمكن تحميلها مجددًا.', 'The JSON file stays with you; it is not uploaded anywhere. Downloaded recitations and hadith books are not included and can be downloaded again.')}
        </Txt>
      </Card>
      <Button title={tr('إنشاء نسخة احتياطية', 'Create backup')} icon={Upload} loading={busy === 'export'} disabled={busy !== null} onPress={onExport} />
      <Button title={tr('استعادة من ملف', 'Restore from file')} icon={Download} tone="soft" loading={busy === 'import'} disabled={busy !== null} onPress={onImport} />
      {message ? (
        <Card tone="soft">
          <Txt>{message}</Txt>
        </Card>
      ) : null}
    </Screen>
  );
}
