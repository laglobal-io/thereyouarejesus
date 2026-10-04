// Live radio streams from Radio Browser (radio-browser.info), a free, open directory of stations.
// Each curated station is matched to its secure (https) stream so it plays right in the page.

import type { Station } from '../data/defaults';
import { getSettings } from './wp';

const SERVERS = ['de1', 'fi1', 'nl1', 'at1', 'de2'].map((s) => `https://${s}.api.radio-browser.info`);
const UA = 'ThereYouAreJesus.com/1.0 (radio player)';

export interface LiveStation {
  key: string; name: string; genre: string; description: string; site: string;
  streams: string[]; image: string; uuid: string;
}
export interface RadioData { stations: LiveStation[]; discover: LiveStation[] }

async function rb(path: string): Promise<any[]> {
  for (const base of SERVERS) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 6000);
    try {
      const res = await fetch(base + path, { headers: { 'User-Agent': UA }, signal: ac.signal });
      if (res.ok) return await res.json();
    } catch { /* try the next server */ } finally { clearTimeout(to); }
  }
  return [];
}

const norm = (s = '') => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
// Browsers on a secure site can only play https streams; HLS (.m3u8) doesn't play in most desktop browsers.
const playable = (s: any) => {
  const url = s.url_resolved || s.url || '';
  return url.startsWith('https://') && !s.hls && !/\.m3u8(\?|$)/i.test(url) && s.lastcheckok === 1;
};
const https = (u = '') => (u.startsWith('https://') ? u : '');

// Confirms a stream answers with audio right now, so only working stations are listed.
async function works(url: string): Promise<boolean> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 5000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal });
    const type = res.headers.get('content-type') || '';
    res.body?.cancel().catch(() => {});
    return res.ok && /audio|ogg|mpeg|aac|octet-stream/i.test(type);
  } catch { return false; } finally { clearTimeout(to); ac.abort(); }
}
const keepWorking = async (urls: string[]) =>
  (await Promise.all(urls.map(async (u) => ((await works(u)) ? u : '')))).filter(Boolean);

async function resolve(st: Station, key: string): Promise<LiveStation> {
  const base: LiveStation = { key, name: st.name, genre: st.genre, description: st.description, site: st.site, streams: [], image: '', uuid: '' };
  if (st.stream) return { ...base, streams: await keepWorking([st.stream]) };
  const want = norm(st.name).split(' ').filter((w) => w && w !== 'radio');
  const attempts = [st.name, st.name.split(' ')[0]];
  for (const q of attempts) {
    const rows = await rb(`/json/stations/byname/${encodeURIComponent(q)}?hidebroken=true&order=votes&reverse=true&limit=60`);
    const hits = rows
      .filter(playable)
      .filter((r) => { const n = norm(r.name); return want.every((w) => n.includes(w)); })
      .sort((a, b) => (b.votes || 0) - (a.votes || 0));
    if (hits.length) {
      const streams = (await keepWorking([...new Set(hits.slice(0, 5).map((h) => h.url_resolved || h.url))] as string[])).slice(0, 3);
      if (streams.length) return { ...base, streams, image: https(hits[0].favicon), uuid: hits[0].stationuuid };
    }
  }
  return base; // No playable stream found: the card links to the station's own player.
}

const GENRES: [RegExp, string][] = [
  [/worship|praise/, 'Worship'], [/gospel/, 'Gospel'], [/hymn/, 'Hymns'],
  [/talk|teaching|preach|sermon|bible/, 'Talk & teaching'], [/ccm|contemporary|pop/, 'Contemporary'],
];
const genreOf = (tags = '') => GENRES.find(([re]) => re.test(tags.toLowerCase()))?.[1] || 'Christian';

async function discover(exclude: Set<string>): Promise<LiveStation[]> {
  const q = (tag: string) => rb(`/json/stations/search?tag=${tag}&is_https=true&hidebroken=true&language=english&order=clickcount&reverse=true&limit=60`);
  const rows = (await Promise.all(['christian', 'gospel', 'worship'].map(q))).flat();
  const seen = new Set(exclude);
  const cand: LiveStation[] = [];
  for (const r of rows.sort((a, b) => (b.clickcount || 0) - (a.clickcount || 0))) {
    const n = norm(r.name);
    if (!n || seen.has(n) || !playable(r)) continue;
    seen.add(n);
    const tags = String(r.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean);
    cand.push({
      key: '', name: String(r.name).trim().slice(0, 60), genre: genreOf(r.tags),
      description: [tags.slice(0, 3).join(', '), r.state || r.country].filter(Boolean).join('. ') || 'Christian radio.',
      site: r.homepage || '', streams: [r.url_resolved || r.url], image: https(r.favicon), uuid: r.stationuuid,
    });
    if (cand.length >= 40) break;
  }
  const ok = await Promise.all(cand.map((c) => works(c.streams[0])));
  return cand.filter((_, i) => ok[i]).slice(0, 24).map((c, i) => ({ ...c, key: `d${i}` }));
}

let cache: { at: number; data: RadioData } | null = null;
export async function getRadio(): Promise<RadioData> {
  if (cache && Date.now() - cache.at < 6 * 3600 * 1000) return cache.data;
  const { stations } = await getSettings();
  const resolved = await Promise.all(stations.map((s, i) => resolve(s, `s${i}`)));
  const disc = await discover(new Set(resolved.map((s) => norm(s.name))));
  // Stations whose live stream can't play here are left out entirely.
  const data = { stations: resolved.filter((s) => s.streams.length), discover: disc };
  cache = { at: Date.now(), data };
  return data;
}

// "Now playing" from the stream's own metadata (ICY), the same info car radios show.
export async function nowPlaying(url: string): Promise<{ artist: string; title: string } | null> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 7000);
  try {
    const res = await fetch(url, { headers: { 'Icy-MetaData': '1', 'User-Agent': UA }, signal: ac.signal });
    const metaint = parseInt(res.headers.get('icy-metaint') || '0', 10);
    if (!res.ok || !metaint || !res.body) return null;
    const reader = res.body.getReader();
    let buf = new Uint8Array(0);
    const readUntil = async (n: number) => {
      while (buf.length < n && buf.length < 600_000) {
        const { value, done } = await reader.read();
        if (done || !value) break;
        const next = new Uint8Array(buf.length + value.length); next.set(buf); next.set(value, buf.length); buf = next;
      }
      return buf.length >= n;
    };
    if (!(await readUntil(metaint + 1))) return null;
    const len = buf[metaint] * 16;
    if (!len || !(await readUntil(metaint + 1 + len))) { reader.cancel().catch(() => {}); return null; }
    const raw = new TextDecoder('utf-8').decode(buf.slice(metaint + 1, metaint + 1 + len)).replace(/\0+$/, '');
    reader.cancel().catch(() => {});
    const m = raw.match(/StreamTitle='(.*?)';/s);
    return m ? parseTitle(m[1]) : null;
  } catch { return null; } finally { clearTimeout(to); ac.abort(); }
}

function parseTitle(t: string): { artist: string; title: string } | null {
  t = t.trim();
  if (!t) return null;
  // Some networks send key="value" pairs inside the title.
  const text = t.match(/text="([^"]*)"/i)?.[1];
  if (text !== undefined) {
    if (/song_spot="[^MT"]/i.test(t) || !text.trim()) return null; // ads, jingles
    return { artist: t.match(/artist="([^"]*)"/i)?.[1]?.trim() || t.split(' - text=')[0].trim(), title: text.trim() };
  }
  if (/^(advert|commercial|spot|station id)/i.test(t)) return null;
  const i = t.indexOf(' - ');
  return i > 0 ? { artist: t.slice(0, i).trim(), title: t.slice(i + 3).trim() } : { artist: '', title: t };
}
