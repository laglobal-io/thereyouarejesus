import { XMLParser } from 'fast-xml-parser';

export interface Episode { title: string; date: string; dateLabel: string; minutes: number; description: string; audio: string; link: string }

export const FEED = import.meta.env.PODCAST_FEED || 'https://feed.podbean.com/thereyouarejesus/feed.xml';

const toMinutes = (d: unknown) => {
  const s = String(d ?? '').trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return Math.round(+s / 60);
  const parts = s.split(':').map(Number);
  const secs = parts.reduce((acc, n) => acc * 60 + (n || 0), 0);
  return Math.max(1, Math.round(secs / 60));
};
const clean = (s: unknown) =>
  String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#8217;/g, '’').replace(/\s+/g, ' ').trim();

export async function getEpisodes(limit = 60): Promise<Episode[]> {
  const res = await fetch(FEED, { headers: { 'User-Agent': 'ThereYouAreJesus.com podcast player' } });
  if (!res.ok) throw new Error(`Podcast feed returned ${res.status}`);
  const xml = await res.text();
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(xml);
  let items = parsed?.rss?.channel?.item ?? [];
  if (!Array.isArray(items)) items = [items];
  return items.slice(0, limit).map((it: any) => {
    const date = new Date(it.pubDate);
    const desc = clean(it['itunes:summary'] || it.description);
    return {
      title: clean(it.title),
      date: isNaN(+date) ? '' : date.toISOString(),
      dateLabel: isNaN(+date) ? '' : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      minutes: toMinutes(it['itunes:duration']),
      description: desc.length > 260 ? desc.slice(0, 257).replace(/\s+\S*$/, '') + '…' : desc,
      audio: it.enclosure?.['@_url'] || '',
      link: typeof it.link === 'string' ? it.link : '',
    };
  });
}
