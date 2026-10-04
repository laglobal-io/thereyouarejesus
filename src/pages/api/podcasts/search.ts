import type { APIRoute } from 'astro';
import { search } from '../../../lib/podcasts';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const cc = (url.searchParams.get('cc') || 'us').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2) || 'us';
  if (!q) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  try {
    return new Response(JSON.stringify(await search(q, cc)), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=3600' } });
  } catch {
    return new Response(JSON.stringify([]), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
};
