import type { APIRoute } from 'astro';
import { getRadio, nowPlaying } from '../../../lib/radio';

export const prerender = false;

let dir: { at: number; urls: Set<string> } | null = null;
async function directoryUrls(origin: string) {
  if (dir && Date.now() - dir.at < 3600_000) return dir.urls;
  const res = await fetch(`${origin}/radio/directory.json`);
  const data = res.ok ? await res.json() : { stations: [] };
  dir = { at: Date.now(), urls: new Set(data.stations.map((s: { u: string }) => s.u)) };
  return dir.urls;
}

// What's playing on a station right now. Only stations listed on this site are checked.
export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key');
  const stream = url.searchParams.get('url');
  let target = '';
  if (key) {
    const data = await getRadio();
    target = data.stations.find((s) => s.key === key)?.streams[0] || '';
  } else if (stream && (await directoryUrls(url.origin)).has(stream)) {
    target = stream;
  }
  const now = target ? await nowPlaying(target) : null;
  return new Response(JSON.stringify(now || {}), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' },
  });
};
