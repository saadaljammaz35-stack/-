// Group khatma client: thin calls to the database functions in
// supabase/migrations/20261026100000_group_khatma.sql. The device's secret token (kept in the
// groups store) is what lets it change the juz it took and the khatmas it created.
import Constants from 'expo-constants';

import { useGroupStore } from '@/store/user';

import { cloud, cloudAvailable } from './cloud';

export const groupsAvailable = cloudAvailable;

export type GroupPart = { juz: number; name: string; done: boolean; mine: boolean; claimedAt: string; doneAt: string | null };
export type GroupKhatma = {
  code: string;
  name: string;
  round: number;
  completedRounds: number;
  createdAt: string;
  owner: boolean;
  parts: GroupPart[];
};

export type GroupErrorKind = 'taken' | 'not-found' | 'not-yours' | 'not-finished' | 'too-many' | 'offline' | 'unknown';
export class GroupError extends Error {
  constructor(public kind: GroupErrorKind, message: string) {
    super(message);
  }
}

const KINDS: [RegExp, GroupErrorKind][] = [
  [/taken/, 'taken'],
  [/not found/, 'not-found'],
  [/not yours/, 'not-yours'],
  [/not finished/, 'not-finished'],
  [/too many/, 'too-many'],
  [/fetch|network|Network request failed/i, 'offline'],
];

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const token = useGroupStore.getState().token;
  let result;
  try {
    result = await cloud().rpc(fn, { ...args, p_token: token });
  } catch (e) {
    throw new GroupError('offline', (e as Error).message);
  }
  if (result.error) {
    const msg = result.error.message ?? '';
    throw new GroupError(KINDS.find(([re]) => re.test(msg))?.[1] ?? 'unknown', msg);
  }
  return result.data as T;
}

const CODE = /^[A-HJKMNP-Z2-9]{8}$/;

/** Normalises what people type or paste: a code or a whole link. */
export function parseGroupCode(input: string): string | null {
  const text = input.trim().toUpperCase();
  const fromLink = text.match(/\/GROUP\/([A-Z0-9]+)/)?.[1];
  const code = (fromLink ?? text).replace(/[\s-]/g, '');
  return CODE.test(code) ? code : null;
}

const webUrl = ((Constants.expoConfig?.extra ?? {}) as { webUrl?: string }).webUrl ?? 'https://ma-allah.vercel.app';
export const groupLink = (code: string) => `${webUrl}/group/${code}`;

export async function viewGroup(code: string): Promise<GroupKhatma> {
  const k = await call<GroupKhatma | null>('gk_view', { p_code: code });
  if (!k) throw new GroupError('not-found', 'not found');
  return k;
}
export const createGroup = (name: string) => call<GroupKhatma>('gk_create', { p_name: name });
export const claimJuz = (code: string, juz: number) => call<GroupKhatma>('gk_claim', { p_code: code, p_juz: juz, p_name: useGroupStore.getState().name });
export const setJuzDone = (code: string, juz: number, done: boolean) => call<GroupKhatma>('gk_set_done', { p_code: code, p_juz: juz, p_done: done });
export const releaseJuz = (code: string, juz: number) => call<GroupKhatma>('gk_release', { p_code: code, p_juz: juz });
export const newRound = (code: string) => call<GroupKhatma>('gk_new_round', { p_code: code });
export const deleteGroup = (code: string) => call<void>('gk_delete', { p_code: code });
