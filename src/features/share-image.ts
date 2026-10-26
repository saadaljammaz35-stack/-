// Turning an on-screen card into an image: shared through the system sheet on phones, saved
// as a download on the web.
import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export const CARD_STYLES = [
  { id: 'cream', bg: '#FBFAF5', ink: '#1F2A1C', accent: '#5A6E51', soft: '#E9EDE3', light: false },
  { id: 'green', bg: '#2F4529', ink: '#F7F5EC', accent: '#C9D8B6', soft: '#3B5434', light: true },
  { id: 'night', bg: '#151A17', ink: '#EDEBE3', accent: '#A9C29B', soft: '#232A25', light: true },
] as const;
export type CardStyle = (typeof CARD_STYLES)[number];

export async function shareViewAsImage(ref: RefObject<ComponentRef<typeof View> | null>, title: string, fileName = 'ma-allah.png'): Promise<void> {
  if (Platform.OS === 'web') {
    const dataUri = await captureRef(ref, { format: 'png', quality: 1, result: 'data-uri' });
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = fileName;
    a.click();
    return;
  }
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
}
