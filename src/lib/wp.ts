// Reads everything from John's WordPress through its built-in REST API.
// Results are cached for the length of one build, so each page doesn't refetch.

import { defaults, type SiteSettings } from '../data/defaults';

export const WP_URL = (import.meta.env.WP_URL || 'https://thereyouarejesus.com').replace(/\/$/, '');

export interface Category {
  id: number; name: string; slug: string; parent: number; count: number;
  description: string; path: string; image: string;
}
export interface Post {
  id: number; slug: string; path: string; title: string; excerpt: string; content: string;
  date: string; dateLabel: string; modified: string; categoryIds: number[];
  primary: Category | null; catSlugs: string[]; image: { url: string; alt: string } | null;
  readMinutes: number;
}
export interface Page { id: number; slug: string; path: string; title: string; content: string; excerpt: string; }

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export function decode(s = ''): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
export const stripTags = (s = '') => decode(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

// Leftover page-builder shortcodes from the old theme (tagDiv, WPBakery, Divi) are removed.
const cleanContent = (html = '') =>
  html.replace(/\[\/?(?:td_|vc_|et_pb_|tdc_)[^\]]*\]/g, '');

const pathOf = (link: string) => {
  try { const p = new URL(link).pathname; return p.endsWith('/') ? p : p + '/'; } catch { return '/'; }
};

async function getJSON(url: string) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`WordPress request failed (${res.status}): ${url}`);
  return { data: await res.json(), pages: Number(res.headers.get('X-WP-TotalPages') || 1) };
}

async function getAll(endpoint: string, params = '') {
  const out: any[] = [];
  let page = 1, total = 1;
  do {
    const { data, pages } = await getJSON(`${WP_URL}/wp-json/wp/v2/${endpoint}?per_page=100&page=${page}${params}`);
    out.push(...data); total = pages; page++;
  } while (page <= total);
  return out;
}

let catCache: Promise<Category[]> | null = null;
export function getCategories(): Promise<Category[]> {
  catCache ??= getAll('categories', '&hide_empty=false').then((rows) =>
    rows.map((c: any) => ({
      id: c.id, name: decode(c.name), slug: c.slug, parent: c.parent, count: c.count,
      description: stripTags(c.description), path: pathOf(c.link), image: c.tyaj_image_url || '',
    })),
  );
  return catCache;
}

export async function ancestorsOf(cat: Category): Promise<Category[]> {
  const cats = await getCategories();
  const chain: Category[] = [];
  let cur: Category | undefined = cat;
  while (cur && cur.parent) {
    cur = cats.find((c) => c.id === cur!.parent);
    if (cur) chain.push(cur);
  }
  return chain;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

let postCache: Promise<Post[]> | null = null;
export function getPosts(): Promise<Post[]> {
  postCache ??= (async () => {
    const [rows, cats] = await Promise.all([getAll('posts', '&_embed=wp:featuredmedia&orderby=date&order=desc'), getCategories()]);
    const posts: Post[] = [];
    for (const p of rows) {
      const ids: number[] = p.categories || [];
      const own = ids.map((id) => cats.find((c) => c.id === id)).filter(Boolean) as Category[];
      // Most specific category wins (e.g. "7 Series" over "Numbers"), skipping Uncategorized.
      const ranked = own.filter((c) => c.slug !== 'uncategorized');
      let primary: Category | null = null, depth = -1;
      for (const c of ranked) { const d = (await ancestorsOf(c)).length; if (d > depth) { depth = d; primary = c; } }
      const slugs = new Set<string>();
      for (const c of own) { slugs.add(c.slug); (await ancestorsOf(c)).forEach((a) => slugs.add(a.slug)); }
      const media = p._embedded?.['wp:featuredmedia']?.[0];
      const content = cleanContent(p.content?.rendered);
      posts.push({
        id: p.id, slug: p.slug, path: pathOf(p.link), title: decode(p.title?.rendered),
        excerpt: stripTags(cleanContent(p.excerpt?.rendered)).replace(/\s*\[…\]\s*$/, '…'),
        content, date: p.date, dateLabel: fmtDate(p.date), modified: p.modified, categoryIds: ids,
        primary, catSlugs: [...slugs],
        image: media?.source_url ? { url: media.source_url, alt: decode(media.alt_text || '') } : null,
        readMinutes: Math.max(1, Math.round(stripTags(content).split(' ').length / 230)),
      });
    }
    return posts;
  })();
  return postCache;
}

let pageCache: Promise<Page[]> | null = null;
export function getPages(): Promise<Page[]> {
  pageCache ??= getAll('pages', '&status=publish').then((rows) =>
    rows.map((p: any) => ({
      id: p.id, slug: p.slug, path: pathOf(p.link), title: decode(p.title?.rendered),
      content: cleanContent(p.content?.rendered), excerpt: stripTags(p.excerpt?.rendered),
    })),
  );
  return pageCache;
}

let settingsCache: Promise<SiteSettings> | null = null;
// Editable in WordPress > Site Settings (from the ThereYouAreJesus plugin). Falls back to defaults until it's installed.
export function getSettings(): Promise<SiteSettings> {
  settingsCache ??= (async () => {
    try {
      const { data } = await getJSON(`${WP_URL}/wp-json/tyaj/v1/settings`);
      const spirits = defaults.spirits.map((d, i) => ({ ...d, ...(data.spirits?.[i] || {}) })).map((s) => ({
        name: s.name || '', verse: s.verse || '', ref: s.ref || '', meaning: s.meaning || '',
      }));
      return {
        heroTitle: data.hero_title || defaults.heroTitle,
        heroText: data.hero_text || defaults.heroText,
        logo: data.logo_url || '',
        notice: { ...defaults.notice, ...(data.notice || {}) },
        spirits,
        stations: Array.isArray(data.stations) && data.stations.length ? data.stations : defaults.stations,
      };
    } catch {
      console.warn('[tyaj] Site settings not found in WordPress yet, using defaults.');
      return defaults;
    }
  })();
  return settingsCache;
}

export const EVIDENCE = ['eyewitness-afterlife', 'numbers', 'everyday-things', 'nature'] as const;
