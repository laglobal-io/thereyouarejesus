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
export interface RadioData { stations: LiveStation[] }

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
  if (st.uuid) {
    const rows = (await rb(`/json/stations/byuuid/${encodeURIComponent(st.uuid)}`)).filter(playable);
    const streams = await keepWorking(rows.map((r) => r.url_resolved || r.url));
    if (streams.length) return { ...base, streams, image: https(rows[0].favicon), uuid: st.uuid };
  }
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

let cache: { at: number; data: RadioData } | null = null;
export async function getRadio(): Promise<RadioData> {
  if (cache && Date.now() - cache.at < 6 * 3600 * 1000) return cache.data;
  const { stations } = await getSettings();
  const resolved = await Promise.all(stations.map((s, i) => resolve(s, `s${i}`)));
  // Stations whose live stream can't play here are left out entirely.
  const data = { stations: resolved.filter((s) => s.streams.length) };
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


// ---------------------------------------------------------------
// Worldwide directory of Christian stations (built into /radio/directory.json at deploy time)
// ---------------------------------------------------------------

export interface DirStation { i: string; n: string; u: string; f: string; c: string; r: string; l: string; g: string; s: string; k: number }

const TAGS = ['christian', 'cristian', 'gospel', 'worship', 'praise', 'louvor', 'ccm', 'catholic', 'catolica', 'catholique',
  'evangel', 'hymn', 'sermon', 'bible', 'chretien', 'christlich', 'adoracion', 'alabanza', 'jesus'];
const CHRISTIAN = /christ|cristian|crist[aã]o|gospel|worship|praise|louvor|ccm|cathol|cat[oó]lic|evangel|hymn|sermon|bible|b[ií]blia|chr[ée]tien|adoraci[oó]n|alabanza|jesus|jes[uú]s|church|iglesia|igreja|kirche|pentecost|baptist|methodist|lutheran|orthodox|anglican|preach/i;
const NOT_ONLY = /christmas|xmas|navidad|weihnacht|no[eë]l/i;

const REGIONS: Record<string, string> = {};
const addRegion = (name: string, codes: string) => codes.split(' ').forEach((c) => { REGIONS[c] = name; });
addRegion('North America', 'US CA');
addRegion('Latin America & Caribbean', 'MX GT BZ SV HN NI CR PA CU DO HT JM PR TT BS BB AG DM GD KN LC VC AW CW KY BM TC VG VI CO VE EC PE BO CL AR UY PY BR GY SR GF');
addRegion('Europe', 'GB IE FR DE NL BE LU CH AT IT ES PT DK NO SE FI IS PL CZ SK HU RO BG GR HR SI RS BA ME MK AL XK UA BY MD LT LV EE RU MT CY LI MC SM AD VA FO GI IM JE GG');
addRegion('Africa', 'NG GH KE ZA UG TZ RW ZM ZW MW MZ AO NA BW LS SZ ET ER SO SS SD EG LY TN DZ MA CM CI SN ML BF NE TD CF CG CD GA GQ BJ TG LR SL GN GW GM MR MG MU SC CV KM DJ BI ST RE YT');
addRegion('Middle East', 'TR IL PS LB SY JO IQ IR SA AE QA KW BH OM YE');
addRegion('Asia', 'CN JP KR KP TW HK MO MN IN PK BD LK NP BT MV AF KZ UZ TM KG TJ TH VN KH LA MM MY SG ID PH BN TL AM AZ GE');
addRegion('Oceania', 'AU NZ FJ PG SB VU WS TO KI FM MH PW NR TV NC PF GU AS MP CK');

const DIR_GENRES: [RegExp, string][] = [
  [/southern gospel|gospel/, 'Gospel'], [/worship|praise|louvor|adoraci|alabanza/, 'Worship'], [/hymn|himno|hino/, 'Hymns'],
  [/cathol|cat[oó]lic/, 'Catholic'], [/talk|teaching|preach|sermon|bible|b[ií]blia|news|predic/, 'Talk & teaching'],
  [/hip ?hop|rap|rock|metal|punk|alternative/, 'Christian rock & hip-hop'], [/ccm|contemporary|pop|adult/, 'Contemporary'],
  [/instrumental|classical|cl[aá]sic/, 'Instrumental & classical'], [/kids|children|infantil/, 'Kids & family'],
];
const cap = (s = '') => s.replace(/\b\w/g, (m) => m.toUpperCase());

export async function getDirectory(): Promise<DirStation[]> {
  const q = (tag: string) => rb(`/json/stations/search?tag=${encodeURIComponent(tag)}&is_https=true&hidebroken=true&order=clickcount&reverse=true&limit=1500`);
  const rows = (await Promise.all(TAGS.map(q))).flat();
  const seen = new Set<string>(), seenName = new Set<string>(), out: DirStation[] = [];
  for (const r of rows.sort((a, b) => (b.clickcount || 0) - (a.clickcount || 0))) {
    const tags = String(r.tags || '').toLowerCase();
    const name = String(r.name || '').trim();
    if (!name || seen.has(r.stationuuid) || !playable(r)) continue;
    if (!CHRISTIAN.test(tags + ' ' + name) || (NOT_ONLY.test(tags) && !CHRISTIAN.test(tags.replace(NOT_ONLY, '')))) continue;
    const nk = norm(name) + '|' + (r.countrycode || '');
    if (seenName.has(nk)) continue;
    seen.add(r.stationuuid); seenName.add(nk);
    const cc = String(r.countrycode || '').toUpperCase();
    out.push({
      i: r.stationuuid, n: name.slice(0, 70), u: r.url_resolved || r.url, f: https(r.favicon),
      c: r.country || '', r: REGIONS[cc] || 'Other', l: cap(String(r.language || '').split(',')[0].trim()) || 'Other',
      g: DIR_GENRES.find(([re]) => re.test(tags))?.[1] || 'Christian music', s: r.state || '', k: r.clickcount || 0,
    });
  }
  return out;
}
