import type { APIRoute } from 'astro';
import { search, parseRef, refLabel } from '../../../lib/bible';
import { BOOKS } from '../../../data/bible';

export const prerender = false;

// Keyword search, or a reference like "John 3:16" (returns where to jump).
export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const t = url.searchParams.get('t') === 'bbe' ? 'bbe' : 'kjv';
  const scope = (['ot', 'nt'].includes(url.searchParams.get('scope') || '') ? url.searchParams.get('scope') : 'all') as 'all' | 'ot' | 'nt';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=86400' };
  if (q.length < 2) return new Response(JSON.stringify({ total: 0, hits: [] }), { headers });
  const ref = parseRef(q);
  if (ref) return new Response(JSON.stringify({ ref: { ...ref, label: refLabel(ref) } }), { headers });
  try {
    const r = await search(t, q, scope);
    return new Response(JSON.stringify({ total: r.total, hits: r.hits.map((h) => ({ ...h, label: `${BOOKS[h.b][0] === 'Psalms' ? 'Psalm' : BOOKS[h.b][0]} ${h.c}:${h.v}` })) }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: 'Search is unavailable right now. Try again in a moment.' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
};
