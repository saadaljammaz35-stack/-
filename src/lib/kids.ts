// «حفظ الصغار»: the short surahs a child usually learns first — al-Fatihah, then Juz ʿAmma from
// an-Nas back to an-Naba — with a star for each verse learned and a crown for each surah a parent
// has heard recited in full.

/** Al-Fatihah, then 114 down to 78. */
export const KIDS_SURAHS: readonly number[] = [1, ...Array.from({ length: 114 - 78 + 1 }, (_, i) => 114 - i)];

export type KidSurah = {
  /** Ayah numbers the child has said back. */
  learned: number[];
  /** A parent heard the whole surah from memory. */
  crowned: boolean;
};
export type Kid = { id: string; name: string; color: string; createdAt: number; surahs: Record<string, KidSurah> };

export const KID_COLORS = ['#E76F51', '#2A9D8F', '#E9C46A', '#8E7DBE', '#4D96FF', '#F28AB2'] as const;

export function learnVerse(kid: Kid, surah: number, ayah: number): Kid {
  const s = kid.surahs[surah] ?? { learned: [], crowned: false };
  if (s.learned.includes(ayah)) return kid;
  return { ...kid, surahs: { ...kid.surahs, [surah]: { ...s, learned: [...s.learned, ayah].sort((a, b) => a - b) } } };
}

export function crownSurah(kid: Kid, surah: number, versesCount: number, crowned = true): Kid {
  const s = kid.surahs[surah] ?? { learned: [], crowned: false };
  const learned = crowned ? Array.from({ length: versesCount }, (_, i) => i + 1) : s.learned;
  return { ...kid, surahs: { ...kid.surahs, [surah]: { learned, crowned } } };
}

export function resetSurah(kid: Kid, surah: number): Kid {
  const surahs = { ...kid.surahs };
  delete surahs[surah];
  return { ...kid, surahs };
}

export type KidStats = { stars: number; crowns: number };
export function kidStats(kid: Kid): KidStats {
  let stars = 0;
  let crowns = 0;
  for (const s of Object.values(kid.surahs)) {
    stars += s.learned.length;
    if (s.crowned) crowns += 1;
  }
  return { stars, crowns };
}

/** The first surah on the list the child has not finished, to suggest next. */
export function nextSurah(kid: Kid, counts: Record<number, number>): number | null {
  for (const n of KIDS_SURAHS) {
    const s = kid.surahs[n];
    if (!s?.crowned && (s?.learned.length ?? 0) < (counts[n] ?? Infinity)) return n;
  }
  return null;
}
