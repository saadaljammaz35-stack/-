// Store and support links come from app.json → expo.extra so they can be set per release
// without code changes. Empty values hide the matching rows.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Extra = { supportEmail?: string; supportUrl?: string; appStoreUrl?: string; playStoreUrl?: string };

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const supportEmail = extra.supportEmail?.trim() || null;
export const supportUrl = extra.supportUrl?.trim() || null;
export const storeUrl = (Platform.OS === 'ios' ? extra.appStoreUrl : Platform.OS === 'android' ? extra.playStoreUrl : extra.playStoreUrl || extra.appStoreUrl)?.trim() || null;
