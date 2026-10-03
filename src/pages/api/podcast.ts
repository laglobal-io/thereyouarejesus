import type { APIRoute } from 'astro';
import { getEpisodes } from '../../lib/podcast';

export const prerender = false;

// Live episode list for the player. Cached at Vercel's edge for 15 minutes.
export const GET: APIRoute = async () => {
  try {
    const episodes = await getEpisodes();
    return new Response(JSON.stringify(episodes), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Podcast feed unavailable' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
};
