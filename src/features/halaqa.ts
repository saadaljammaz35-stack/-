// «حلقة قراءة متزامنة»: one reader leads and everyone else's mushaf turns with them, wherever they
// are. A Supabase Realtime broadcast channel per circle; nothing is stored. The leader sends the
// page (and the verse being read) on each change and every few seconds for anyone joining late;
// presence lists who is there by the name they chose.
import type { RealtimeChannel } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { getRandomBytes, randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useGroupStore } from '@/store/user';

import { cloud, cloudAvailable } from './cloud';

export const halaqaAvailable = cloudAvailable;

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newHalaqaCode(): string {
  return Array.from(getRandomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');
}
const CODE = /^[A-HJKMNP-Z2-9]{6}$/;
/** A code typed in, or the code inside an invite link. */
export function parseHalaqaCode(input: string): string | null {
  const text = input.trim().toUpperCase();
  const code = (text.match(/\/HALAQA\/([A-Z0-9]+)/)?.[1] ?? text).replace(/[\s-]/g, '');
  return CODE.test(code) ? code : null;
}

const webUrl = ((Constants.expoConfig?.extra ?? {}) as { webUrl?: string }).webUrl ?? 'https://ma-allah.vercel.app';
export const halaqaLink = (code: string) => `${webUrl}/halaqa/${code}`;

export type HalaqaState = { page: number; verse: number | null };
export type Participant = { key: string; name: string; leader: boolean };

/** Joins a circle as leader or listener. The leader's `state` is broadcast; a listener receives it. */
export function useHalaqa(code: string, leader: boolean, initial: HalaqaState) {
  // Presence keys are visible to everyone in the channel, so never the device's secret token.
  const [key] = useState(() => randomUUID());
  const name = useGroupStore((s) => s.name);
  const [state, setState] = useState<HalaqaState>(initial);
  const [people, setPeople] = useState<Participant[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stateRef = useRef(initial);

  useEffect(() => {
    if (!cloudAvailable) return;
    const channel = cloud().channel(`halaqa-${code}`, { config: { broadcast: { self: false }, presence: { key } } });
    channelRef.current = channel;
    const send = () => channel.send({ type: 'broadcast', event: 'state', payload: stateRef.current }).catch(() => undefined);
    channel
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        if (!leader) {
          stateRef.current = payload as HalaqaState;
          setState(payload as HalaqaState);
        }
      })
      .on('broadcast', { event: 'hello' }, () => {
        if (leader) send();
      })
      .on('presence', { event: 'sync' }, () => {
        const list = Object.entries(channel.presenceState<{ name: string; leader: boolean }>()).map(([key, metas]) => ({ key, name: metas[0]?.name ?? '', leader: !!metas[0]?.leader }));
        setPeople(list.sort((a, b) => Number(b.leader) - Number(a.leader)));
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        setConnected(true);
        channel.track({ name: name || '؟', leader }).catch(() => undefined);
        if (leader) send();
        else channel.send({ type: 'broadcast', event: 'hello', payload: {} }).catch(() => undefined);
      });
    // The leader repeats the page now and then for anyone who joined in between.
    const beat = leader ? setInterval(send, 5000) : null;
    return () => {
      if (beat) clearInterval(beat);
      channel.unsubscribe();
      channelRef.current = null;
      setConnected(false);
    };
  }, [code, leader, key, name]);

  /** Leader only: move everyone to a page (and optionally a verse). */
  const lead = useCallback((next: HalaqaState) => {
    setState(next);
    stateRef.current = next;
    channelRef.current?.send({ type: 'broadcast', event: 'state', payload: next }).catch(() => undefined);
  }, []);

  return { state, lead, people, connected };
}
