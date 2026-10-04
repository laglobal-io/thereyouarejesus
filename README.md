# ThereYouAreJesus.com

The new ThereYouAreJesus.com. John keeps writing in WordPress exactly as he does today; this site reads his posts, pages and settings from WordPress and publishes them in the new design on Vercel.

## How it fits together

- **WordPress** is where John writes. Posts, pages, categories, category images, homepage wording, the Seven Spirits text and the radio station list are all edited there.
- **This site** (Astro) builds fast static pages from WordPress. When John publishes or edits something, WordPress pings Vercel and the site rebuilds itself in about two minutes.
- **Podcast** episodes come from the Podbean feed. New episodes show up within about 15 minutes, no rebuild needed.
- **Share Your Thoughts** messages are saved in WordPress under **Messages** and emailed to John.
- **Email signup** goes to Kit. **Memberships** link to Memberful. **Store** links to Shopify.

## 1. Install the WordPress plugin

1. In WordPress, go to **Plugins > Add New > Upload Plugin**.
2. Upload `wordpress/tyaj-headless.zip` and activate **ThereYouAreJesus Site Connector**.
3. A **Site Settings** item and a **Messages** item appear in the left menu. Leave Site Settings for now; you'll come back to it in step 3.

Back up WordPress before installing (most hosts have a one-click backup).

## 2. Put the code on GitHub and Vercel

```bash
npm install
npm run dev        # preview locally at http://localhost:4321
```

1. Create a new GitHub repository and push this folder to it.
2. In Vercel, choose **Add New > Project**, import the repository. Vercel detects Astro automatically.
3. Before the first deploy, add the environment variables below under **Settings > Environment Variables**, then deploy.

| Variable | What to put |
|---|---|
| `WP_URL` | `https://thereyouarejesus.com` for now. Change to `https://cms.thereyouarejesus.com` at cutover (step 5). |
| `PODCAST_FEED` | `https://feed.podbean.com/thereyouarejesus/feed.xml` |
| `TYAJ_FORM_SECRET` | Copy from WordPress **Site Settings > Connection > Form secret**. |
| `PUBLIC_KIT_FORM_ACTION` | From Kit: open the form, choose **Embed > HTML**, copy the `action="..."` URL. |
| `PUBLIC_PASSION_URL`, `PUBLIC_DEVOUT_URL` | Memberful checkout links. Leave empty until memberships open; the buttons say "opening soon". |
| `PUBLIC_STORE_URL` | Shopify store address. Leave empty until the store opens. |
| `PUBLIC_DONATE_URL` | The Stripe donation link (already filled in `.env.example`). |

For local development, copy `.env.example` to `.env` and fill it in.

After changing any environment variable in Vercel, redeploy so the change takes effect.

## 3. Connect WordPress to Vercel

1. In Vercel: **Project Settings > Git > Deploy Hooks**. Create a hook named `wordpress` on the `main` branch and copy the URL.
2. In WordPress: **Site Settings > Connection**, paste it into **Vercel deploy hook**.
3. Set **Send messages to** to John's email address. Save.

Now publishing, editing or deleting a post rebuilds the site. The **Rebuild the site now** button on Site Settings forces a rebuild if something hasn't appeared.

## 4. Fill in the content

- **Logo**: Site Settings > Logo.
- **Category images**: Posts > Categories > edit each of Eyewitness Afterlife, Numbers, Everyday Things and Nature > Category image. Any file name works. Eyewitness Afterlife is a tall tile (about 1600 × 1200 or larger); the other three are wide tiles (about 1200 × 600). Text sits along the bottom over a dark fade. Category descriptions show on the tiles too, so keep them to one short sentence.
- **Homepage wording, announcement panel, Seven Spirits text**: Site Settings. Empty fields keep the default wording from `src/data/defaults.ts`.
- **Radio stations**: Site Settings > Live radio stations, one per line:
  `Name | Genre | Short description | Website | Stream URL`
  The stream URL is optional. Without one, the site finds the station's secure stream in the free Radio Browser directory (radio-browser.info) and plays it in the page, with backups if one stream is down. Only add a stream URL to override that. Every stream is checked before stations are listed, and stations whose live stream can't play are left out automatically (and removed on the spot if they fail while someone is listening). The **Discover more** filter adds popular Christian stations from the same directory automatically.
- **Featured images** set on posts appear at the top of each post.

Check the site on its `*.vercel.app` address before going live: open a dozen posts from different years and look for leftover formatting from the old theme.

## 5. Go live (cutover)

Do this at a quiet time, with WordPress backed up. If your host offers support, ask them to help with steps 1 and 2.

1. **Give WordPress its own address.** Create `cms.thereyouarejesus.com` at your host, pointing to the same WordPress install, with SSL enabled.
2. In WordPress **Settings > General**, change both **WordPress Address** and **Site Address** to `https://cms.thereyouarejesus.com`. You'll log in at `cms.thereyouarejesus.com/wp-admin` from now on.
3. In WordPress **Site Settings > Connection**, set **Public site address** to `https://thereyouarejesus.com`. Anyone who lands on the WordPress address is now sent to the public site, and the WordPress copy is hidden from search engines.
4. In Vercel, set `WP_URL` to `https://cms.thereyouarejesus.com` and redeploy.
5. In Vercel **Settings > Domains**, add `thereyouarejesus.com` and `www.thereyouarejesus.com`, then update DNS at your domain registrar as Vercel instructs.
6. Once DNS has switched (minutes to a few hours), check: the homepage, a few old post links from Google, `/feed/`, the Share Your Thoughts form (a test message should arrive in Messages and by email), and a test post publish.

Old links keep working: posts and pages keep their addresses, `/share-your-thoughts/` goes to `/share/`, `/feed/` goes to `/feed.xml`, and old image links under `/wp-content/` are forwarded to WordPress (see `vercel.json`).

## Project map

```
src/pages/index.astro             Homepage
src/pages/[...path].astro         Every post and page, at its existing address
src/pages/category/[...path].astro Category pages
src/pages/share.astro             Share Your Thoughts form
src/pages/feed.xml.ts             RSS feed (used by Kit for new-post emails)
src/pages/api/podcast.ts          Live podcast episode list
src/pages/api/share.ts            Receives the form and sends it to WordPress
src/pages/api/radio/              Live radio streams and "now playing" info (src/lib/radio.ts)
src/components/                   Homepage sections
src/data/defaults.ts              Default wording, membership tiers, store items, socials
src/lib/wp.ts                     Reads from WordPress
src/scripts/site.ts               Flames, player, radio, filters, forms
src/styles/global.css             The theme
wordpress/tyaj-headless.zip       WordPress plugin to upload
```

## Changing things later

- **Membership tier names, prices and perks**: `src/components/Join.astro`.
- **Store products**: `src/data/defaults.ts` (`products`). When the Shopify store is ready, these can link to individual products.
- **John's account on the homepage**: `src/components/Testimony.astro`.
- **Share Your Thoughts topics**: `src/data/defaults.ts` (`topics`).
