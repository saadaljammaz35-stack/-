// Offline recitations: surah audio files saved under the app's documents directory.
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { getChapterAudio } from '@/data/remote';

type DownloadState = {
  progress: Record<string, number>;
  version: number;
  setProgress: (key: string, value: number | null) => void;
  bump: () => void;
};

export const useDownloads = create<DownloadState>((set) => ({
  progress: {},
  version: 0,
  setProgress: (key, value) =>
    set((s) => {
      const progress = { ...s.progress };
      if (value == null) delete progress[key];
      else progress[key] = value;
      return { progress };
    }),
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export const downloadsSupported = Platform.OS !== 'web';

function reciterDir(reciterId: number): Directory {
  return new Directory(Paths.document, 'recitations', String(reciterId));
}

export function surahFile(reciterId: number, surah: number): File {
  return new File(reciterDir(reciterId), `${surah}.mp3`);
}

export function isDownloaded(reciterId: number, surah: number): boolean {
  if (!downloadsSupported) return false;
  try {
    return surahFile(reciterId, surah).exists;
  } catch {
    return false;
  }
}

export async function downloadSurah(reciterId: number, surah: number): Promise<void> {
  if (!downloadsSupported) throw new Error('downloads are not available on web');
  const key = `${reciterId}:${surah}`;
  const { setProgress, bump } = useDownloads.getState();
  const audio = await getChapterAudio(reciterId, surah);
  const dir = reciterDir(reciterId);
  if (!dir.exists) dir.create({ intermediates: true });
  const target = surahFile(reciterId, surah);
  const partial = new File(dir, `${surah}.part`);
  if (partial.exists) partial.delete();
  setProgress(key, 0);
  try {
    const task = File.createDownloadTask(audio.url, partial, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        const total = totalBytes > 0 ? totalBytes : audio.sizeBytes;
        setProgress(key, total > 0 ? bytesWritten / total : 0);
      },
    });
    await task.downloadAsync();
    if (target.exists) target.delete();
    partial.move(target);
  } finally {
    setProgress(key, null);
    bump();
  }
}

export function deleteSurah(reciterId: number, surah: number) {
  const f = surahFile(reciterId, surah);
  if (f.exists) f.delete();
  useDownloads.getState().bump();
}

export function downloadedSurahs(reciterId: number): number[] {
  if (!downloadsSupported) return [];
  const dir = reciterDir(reciterId);
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((e): e is File => e instanceof File && e.name.endsWith('.mp3'))
    .map((f) => Number(f.name.replace('.mp3', '')))
    .filter((n) => n >= 1 && n <= 114)
    .sort((a, b) => a - b);
}

export function downloadedBytes(): number {
  if (!downloadsSupported) return 0;
  const root = new Directory(Paths.document, 'recitations');
  if (!root.exists) return 0;
  let total = 0;
  const walk = (d: Directory) => {
    for (const e of d.list()) {
      if (e instanceof Directory) walk(e);
      else total += e.size ?? 0;
    }
  };
  walk(root);
  return total;
}

export function deleteAllDownloads(): void {
  if (!downloadsSupported) return;
  const root = new Directory(Paths.document, 'recitations');
  if (root.exists) root.delete();
  useDownloads.getState().bump();
}
