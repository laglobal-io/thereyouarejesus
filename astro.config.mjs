import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// Pages are prebuilt as static HTML. The two routes in src/pages/api run on demand.
export default defineConfig({
  site: 'https://thereyouarejesus.com',
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'ignore',
});
