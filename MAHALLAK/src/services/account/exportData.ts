import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes the export to a private cache file and opens the system share sheet. */
export async function shareExport(data: Record<string, unknown>): Promise<void> {
  const name = `mahallak-export-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: name, UTI: 'public.json' });
}
