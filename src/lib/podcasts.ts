// Christian podcasts from Apple Podcasts' public charts, search and lookup (no account or key needed).

export interface Pod { id: string; title: string; author: string; art: string; summary: string; rank: number; regions?: number; url: string }
export interface Episode { title: string; date: string; minutes: number; description: string; audio: string; art: string }
export interface Show extends Pod { description: string; feed: string; episodes: Episode[] }

const CHRISTIANITY = 1439; // Apple's "Christianity" podcast category

export const STORES: [string, string][] = [
  ['us', 'United States'], ['gb', 'United Kingdom'], ['ca', 'Canada'], ['au', 'Australia'], ['ie', 'Ireland'],
  ['nz', 'New Zealand'], ['ng', 'Nigeria'], ['za', 'South Africa'], ['ke', 'Kenya'], ['gh', 'Ghana'],
  ['ph', 'Philippines'], ['in', 'India'], ['sg', 'Singapore'], ['jm', 'Jamaica'], ['br', 'Brazil'],
  ['mx', 'Mexico'], ['es', 'Spain'], ['de', 'Germany'], ['fr', 'France'], ['kr', 'South Korea'],
];
const WORLD = ['us', 'gb', 'ca', 'au', 'ie', 'nz', 'ng', 'za', 'ke', 'gh', 'ph', 'sg'];

const big = (u = '') => u.replace(/\/\d+x\d+(bb)?(\.\w+)$/, '/600x600bb$2');
const clean = (s = '') => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&#39;|&#8217;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);

async function getJSON(url: string) {
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 8000);
  try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); }
  finally { clearTimeout(to); }
}

export async function chart(cc: string): Promise<Pod[]> {
  try {
    const d = await getJSON(`https://itunes.apple.com/${cc}/rss/toppodcasts/limit=100/genre=${CHRISTIANITY}/json`);
    let rows = d?.feed?.entry || [];
    if (!Array.isArray(rows)) rows = [rows];
    if (rows.length) return rows.map((e: any, i: number) => ({
      id: String(e.id?.attributes?.['im:id'] || ''), title: e['im:name']?.label || '', author: e['im:artist']?.label || '',
      art: big(e['im:image']?.[e['im:image'].length - 1]?.label || ''), summary: cut(clean(e.summary?.label || ''), 400),
      rank: i + 1, url: e.link?.attributes?.href || e.id?.label || '',
    })).filter((p: Pod) => p.id);
  } catch { /* fall back to search below */ }
  return (await search('christian', cc)).map((p, i) => ({ ...p, rank: i + 1 }));
}

export async function worldwide(): Promise<Pod[]> {
  const charts = await Promise.all(WORLD.map((cc) => chart(cc).catch(() => [] as Pod[])));
  const by = new Map<string, Pod & { score: number }>();
  for (const list of charts) for (const p of list) {
    const cur = by.get(p.id);
    const pts = 101 - p.rank;
    if (cur) { cur.score += pts; cur.regions = (cur.regions || 1) + 1; } else by.set(p.id, { ...p, score: pts, regions: 1 });
  }
  return [...by.values()].sort((a, b) => b.score - a.score).slice(0, 150).map(({ score, ...p }, i) => ({ ...p, rank: i + 1 }));
}

export async function search(term: string, cc = 'us'): Promise<Pod[]> {
  const d = await getJSON(`https://itunes.apple.com/search?media=podcast&entity=podcast&limit=100&country=${encodeURIComponent(cc)}&term=${encodeURIComponent(term)}`);
  return (d.results || [])
    .filter((r: any) => (r.genreIds || []).map(String).includes(String(CHRISTIANITY)) || (r.genres || []).includes('Christianity'))
    .slice(0, 60)
    .map((r: any, i: number) => ({
      id: String(r.collectionId), title: r.collectionName || '', author: r.artistName || '', art: big(r.artworkUrl600 || r.artworkUrl100 || ''),
      summary: '', rank: i + 1, url: r.collectionViewUrl || '',
    }));
}

// Reads only the start of a podcast's feed to get its description.
async function feedDescription(feed: string): Promise<string> {
  if (!feed) return '';
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 6000);
  try {
    const res = await fetch(feed, { signal: ac.signal });
    if (!res.ok || !res.body) return '';
    const reader = res.body.getReader(); let text = ''; const dec = new TextDecoder();
    while (text.length < 120_000) { const { value, done } = await reader.read(); if (done || !value) break; text += dec.decode(value, { stream: true }); if (/<item[\s>]/i.test(text)) break; }
    reader.cancel().catch(() => {});
    const head = text.split(/<item[\s>]/i)[0];
    const m = head.match(/<itunes:summary>([\s\S]*?)<\/itunes:summary>/i) || head.match(/<description>([\s\S]*?)<\/description>/i);
    return m ? cut(clean(m[1]), 700) : '';
  } catch { return ''; } finally { clearTimeout(to); ac.abort(); }
}

export async function show(id: string, cc = 'us'): Promise<Show | null> {
  const d = await getJSON(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&entity=podcastEpisode&limit=12&country=${encodeURIComponent(cc)}`);
  const rows: any[] = d.results || [];
  const pod = rows.find((r) => r.kind === 'podcast' || r.wrapperType === 'track' && r.collectionId && !r.episodeUrl);
  if (!pod) return null;
  const episodes: Episode[] = rows.filter((r) => r.episodeUrl).slice(0, 10).map((r) => ({
    title: r.trackName || '', date: r.releaseDate || '', minutes: Math.round((r.trackTimeMillis || 0) / 60000),
    description: cut(clean(r.shortDescription || r.description || ''), 260),
    audio: String(r.episodeUrl).replace(/^http:\/\//, 'https://'), art: big(r.artworkUrl600 || r.artworkUrl160 || ''),
  }));
  return {
    id: String(pod.collectionId), title: pod.collectionName || '', author: pod.artistName || '', art: big(pod.artworkUrl600 || pod.artworkUrl100 || ''),
    summary: '', rank: 0, url: pod.collectionViewUrl || '', feed: pod.feedUrl || '',
    description: await feedDescription(pod.feedUrl), episodes,
  };
}
