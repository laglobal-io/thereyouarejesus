import type { APIRoute } from 'astro';
import { getRadio } from '../../../lib/radio';

export const prerender = false;

// Station list with playable stream addresses. Cached at Vercel's edge for 6 hours.
export const GET: APIRoute = async () => {
  try {
    const data = await getRadio();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' },
    });
  } catch {
    return new Response(JSON.stringify({ stations: [] }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
};
