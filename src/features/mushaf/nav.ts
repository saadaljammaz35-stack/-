// Lets other screens (the index, search results) move an already-open mushaf to a page.
import { create } from 'zustand';

type MushafNav = { request: { page: number; verse?: number; at: number } | null; go: (page: number, verse?: number) => void };

export const useMushafNav = create<MushafNav>((set) => ({
  request: null,
  go: (page, verse) => set({ request: { page, verse, at: Date.now() } }),
}));
