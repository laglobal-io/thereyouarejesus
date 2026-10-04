import type { APIRoute } from 'astro';
import { show } from '../../../lib/podcasts';

export const prerender = false;

// One podcast's description and latest episodes.
export const GET: APIRoute = async ({ url }) => {
  const id = (url.searchParams.get('id') || '').replace(/\D/g, '');
  const cc = (url.searchParams.get('cc') || 'us').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2) || 'us';
  if (!id) return new Response('Missing id', { status: 400 });
  try {
    const s = await show(id, cc);
    if (!s) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(s), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch {
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
};
