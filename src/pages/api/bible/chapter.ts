import type { APIRoute } from 'astro';
import { chapter } from '../../../lib/bible';
import { BOOKS } from '../../../data/bible';

export const prerender = false;
const json = (b: unknown, status = 200, cache = 'public, s-maxage=31536000, immutable') =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } });

// One chapter, one or two translations: /api/bible/chapter?b=42&c=3&t=kjv,bbe  (b is 0-based: 42 = John)
export const GET: APIRoute = async ({ url }) => {
  const b = Number(url.searchParams.get('b')), c = Number(url.searchParams.get('c'));
  const ts = (url.searchParams.get('t') || 'kjv').split(',').filter((t) => ['kjv', 'bbe'].includes(t)).slice(0, 2);
  if (!BOOKS[b] || !(c >= 1 && c <= BOOKS[b][1]) || !ts.length) return json({ error: 'Unknown book or chapter' }, 400, 'no-store');
  try {
    const out: Record<string, string[]> = {};
    for (const t of ts) out[t] = await chapter(t, b, c);
    return json({ book: BOOKS[b][0], b, c, chapters: BOOKS[b][1], text: out });
  } catch { return json({ error: 'The Bible text is unavailable right now. Try again in a moment.' }, 502, 'no-store'); }
};
