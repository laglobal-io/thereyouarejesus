import type { APIRoute } from 'astro';
import { chart, worldwide, STORES } from '../../../lib/podcasts';

export const prerender = false;

// Top Christian podcasts for a region (?cc=us), or worldwide popularity (?cc=all).
export const GET: APIRoute = async ({ url }) => {
  const cc = (url.searchParams.get('cc') || 'all').toLowerCase();
  if (cc !== 'all' && !STORES.some(([c]) => c === cc)) return new Response('Unknown region', { status: 400 });
  try {
    const pods = cc === 'all' ? await worldwide() : await chart(cc);
    return new Response(JSON.stringify(pods), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } });
  } catch {
    return new Response(JSON.stringify([]), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
};
