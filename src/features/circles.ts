// «دائرة العائلة» (up to 20) and «رفيق الأذكار» (two people): thin calls to the database functions
// in supabase/migrations/20261030000000_circles.sql. Each member shares, when they choose, only
// whether today they prayed all five, said the morning and evening adhkar and read some Quran.
import Constants from 'expo-constants';

import { addCivilDays, civilKey, type CivilDate } from '@/lib/hijri';
import { useGroupStore } from '@/store/user';

import { cloudAvailable } from './cloud';
import { call, GroupError } from './group-khatma';

export const circlesAvailable = cloudAvailable;

export type CircleKind = 'family' | 'buddy';
export type DayFlags = { prayers: boolean; morning: boolean; evening: boolean; quran: boolean };
export type CircleMember = DayFlags & { id: string; name: string; mine: boolean; cheers: number; cheered: boolean };
export type Circle = { code: string; name: string; kind: CircleKind; owner: boolean; member: boolean; streak: number | null; members: CircleMember[] };

export const CIRCLE_LIMIT: Record<CircleKind, number> = { family: 20, buddy: 2 };

const CODE = /^[A-HJKMNP-Z2-9]{8}$/;
export function parseCircleCode(input: string): string | null {
  const text = input.trim().toUpperCase();
  const code = (text.match(/\/CIRCLE\/([A-Z0-9]+)/)?.[1] ?? text).replace(/[\s-]/g, '');
  return CODE.test(code) ? code : null;
}
const webUrl = ((Constants.expoConfig?.extra ?? {}) as { webUrl?: string }).webUrl ?? 'https://ma-allah.vercel.app';
export const circleLink = (code: string) => `${webUrl}/circle/${code}`;

const name = () => useGroupStore.getState().name || '؟';

export async function viewCircle(code: string, day: CivilDate): Promise<Circle> {
  const c = await call<Circle | null>('cc_view', { p_code: code, p_day: civilKey(day) });
  if (!c) throw new GroupError('not-found', 'not found');
  return c;
}
export const createCircle = (title: string, kind: CircleKind, day: CivilDate) => call<Circle>('cc_create', { p_name: title, p_kind: kind, p_member_name: name(), p_day: civilKey(day) });
export const joinCircle = (code: string, day: CivilDate) => call<Circle>('cc_join', { p_code: code, p_member_name: name(), p_day: civilKey(day) });
export const reportDay = (code: string, day: CivilDate, f: DayFlags) =>
  call<Circle>('cc_report', { p_code: code, p_day: civilKey(day), p_prayers: f.prayers, p_morning: f.morning, p_evening: f.evening, p_quran: f.quran });
export const cheer = (code: string, member: string, day: CivilDate) => call<Circle>('cc_cheer', { p_code: code, p_member: member, p_day: civilKey(day) });
export const leaveCircle = (code: string) => call<void>('cc_leave', { p_code: code });

/** «لوحة الأسبوع»: the circle as it was on each of the last seven days (oldest first). */
export async function viewWeek(code: string, today: CivilDate): Promise<{ day: CivilDate; circle: Circle }[]> {
  const days = Array.from({ length: 7 }, (_, i) => addCivilDays(today, i - 6));
  return Promise.all(days.map(async (day) => ({ day, circle: await viewCircle(code, day) })));
}
