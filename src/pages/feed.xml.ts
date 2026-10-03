import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts } from '../lib/wp';

// Replaces WordPress's /feed/ (redirected here in vercel.json). Kit uses this to email new posts.
export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: 'There You Are Jesus!',
    description: 'Modern day evidence of two-way communication with God.',
    site: context.site!,
    items: posts.slice(0, 30).map((p) => ({
      title: p.title, link: p.path, pubDate: new Date(p.date), description: p.excerpt,
      categories: p.primary ? [p.primary.name] : [],
    })),
  });
}
