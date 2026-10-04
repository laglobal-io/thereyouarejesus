// Public-domain Bible text (King James Version and Bible in Basic English), loaded once per server instance.

import { BOOKS } from '../data/bible';

const SOURCES: Record<string, string> = {
  kjv: import.meta.env.BIBLE_KJV_URL || 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json',
  bbe: import.meta.env.BIBLE_BBE_URL || 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_bbe.json',
};
type Text = string[][][]; // book -> chapter -> verse
const cache = new Map<string, Promise<Text>>();

const tidy = (v: string) => v.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();

export function loadBible(t: string): Promise<Text> {
  const id = SOURCES[t] ? t : 'kjv';
  if (!cache.has(id)) {
    cache.set(id, fetch(SOURCES[id]).then(async (r) => {
      if (!r.ok) throw new Error(`Bible text unavailable (${r.status})`);
      const raw = (await r.text()).replace(/^\uFEFF/, '');
      const books: { chapters: string[][] }[] = JSON.parse(raw);
      return books.map((b) => b.chapters.map((ch) => ch.map(tidy)));
    }).catch((e) => { cache.delete(id); throw e; }));
  }
  return cache.get(id)!;
}

export interface Ref { b: number; c: number; v1?: number; v2?: number }

// Accepts "John 3:16", "jn 3", "1 cor 13:4-7", "Psalm 23", "rev 4:5".
const ALIASES: Record<string, string> = { psalm: 'Psalms', ps: 'Psalms', song: 'Song of Solomon', 'song of songs': 'Song of Solomon', revelations: 'Revelation', jn: 'John', mt: 'Matthew', mk: 'Mark', lk: 'Luke' };
export function parseRef(input: string): Ref | null {
  const m = input.trim().match(/^((?:[1-3]\s*)?[a-z][a-z .]*?)\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?$/i);
  if (!m) return null;
  const name = m[1].replace(/\./g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const target = ALIASES[name] || name;
  const exact = BOOKS.findIndex(([n]) => n.toLowerCase() === target.toLowerCase());
  const idx = exact >= 0 ? exact : BOOKS.findIndex(([n]) => n.toLowerCase().replace(/\s/g, '').startsWith(target.toLowerCase().replace(/\s/g, '')));
  if (idx < 0) return null;
  const c = +m[2];
  if (c < 1 || c > BOOKS[idx][1]) return null;
  return { b: idx, c, v1: m[3] ? +m[3] : undefined, v2: m[4] ? +m[4] : m[3] ? +m[3] : undefined };
}
export const refLabel = (r: Ref) => `${BOOKS[r.b][0] === 'Psalms' && r.v1 ? 'Psalm' : BOOKS[r.b][0]} ${r.c}${r.v1 ? `:${r.v1}${r.v2 && r.v2 !== r.v1 ? `–${r.v2}` : ''}` : ''}`;

export async function chapter(t: string, b: number, c: number) {
  const text = await loadBible(t);
  return text[b]?.[c - 1] || [];
}

export async function passage(t: string, r: Ref) {
  const verses = await chapter(t, r.b, r.c);
  const from = r.v1 || 1, to = Math.min(r.v2 || r.v1 || verses.length, verses.length);
  return verses.slice(from - 1, to).map((text, i) => ({ v: from + i, text }));
}

export async function search(t: string, q: string, scope: 'all' | 'ot' | 'nt' = 'all', limit = 100) {
  const text = await loadBible(t);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const phrase = q.toLowerCase().trim();
  const hits: { b: number; c: number; v: number; text: string; exact: boolean }[] = [];
  let total = 0;
  const [start, end] = scope === 'ot' ? [0, 39] : scope === 'nt' ? [39, 66] : [0, 66];
  for (let b = start; b < end; b++) {
    text[b]?.forEach((ch, ci) => ch.forEach((v, vi) => {
      const low = v.toLowerCase();
      if (words.every((w) => low.includes(w))) {
        total++;
        if (hits.length < limit) hits.push({ b, c: ci + 1, v: vi + 1, text: v, exact: low.includes(phrase) });
      }
    }));
  }
  hits.sort((a, b) => Number(b.exact) - Number(a.exact));
  return { total, hits };
}
