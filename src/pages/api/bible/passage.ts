import type { APIRoute } from 'astro';
import { passage, parseRef, refLabel } from '../../../lib/bible';

export const prerender = false;

// Text of a reference in both translations: /api/bible/passage?ref=Isaiah%2011:2
export const GET: APIRoute = async ({ url }) => {
  const r = parseRef(url.searchParams.get('ref') || '');
  if (!r) return new Response(JSON.stringify({ error: 'Unknown reference' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  try {
    const [kjv, bbe] = await Promise.all([passage('kjv', r), passage('bbe', r)]);
    return new Response(JSON.stringify({ ref: { ...r, label: refLabel(r) }, kjv, bbe }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=31536000, immutable' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'The Bible text is unavailable right now.' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
};
