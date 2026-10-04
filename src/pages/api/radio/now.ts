import type { APIRoute } from 'astro';
import { getRadio, nowPlaying } from '../../../lib/radio';

export const prerender = false;

// What's playing on a station right now. Only stations from our own list are checked.
export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key') || '';
  const data = await getRadio();
  const st = [...data.stations, ...data.discover].find((s) => s.key === key);
  const now = st?.streams[0] ? await nowPlaying(st.streams[0]) : null;
  return new Response(JSON.stringify(now || {}), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' },
  });
};
