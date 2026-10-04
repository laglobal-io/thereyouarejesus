# ThereYouAreJesus.com

The new ThereYouAreJesus.com. John keeps writing in WordPress exactly as he does today; this site reads his posts, pages and settings from WordPress and publishes them in the new design on Vercel.

## How it fits together

- **WordPress** is where John writes. Posts, pages, categories, category images, homepage wording, the Seven Spirits text and the radio station list are all edited there.
- **This site** (Astro) builds fast static pages from WordPress. When John publishes or edits something, WordPress pings Vercel and the site rebuilds itself in about two minutes.
- **Podcast** episodes come from the Podbean feed. New episodes show up within about 15 minutes, no rebuild needed.
- **One player for everything**: John's podcast, featured radio, the full radio directory (/radio) and discovered podcasts (/podcasts) all play in the bar at the bottom, which keeps playing as visitors move between pages.
- **Radio directory** (/radio): Christian stations worldwide from Radio Browser, refreshed on every deploy, filterable by region, genre and language. Featured stations on the homepage are listed first, in the order set in `src/data/defaults.ts` (Air1, then Jesus Worship Club Radio, and so on).
- **Discover podcasts** (/podcasts): Apple Podcasts' Christianity charts by region, a worldwide popularity ranking, and search.
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

## 5. Bible study accounts (Passion and Devout)

Everyone can read, search, compare and share the Bible at /bible. Passion and Devout members can also save verses, highlight and write notes, which are stored in their account. Accounts use Supabase (sign-in by emailed link, no passwords), and Memberful tells the site who is a member.

1. **Supabase:** create a free project at supabase.com. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, and click **Run**.
2. In Supabase **Authentication > URL Configuration**, set **Site URL** to `https://thereyouarejesus.com` and add `https://thereyouarejesus.com/bible/` (and your `.vercel.app` address while testing) under **Redirect URLs**.
3. In Supabase **Project Settings > API**, copy the Project URL, the `anon` key and the `service_role` key into Vercel as `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. The service key is secret; it must never go in a `PUBLIC_` variable.
4. **Memberful:** in **Settings > Webhooks**, add `https://thereyouarejesus.com/api/memberful/webhook`, tick the member and subscription events, and copy its secret into Vercel as `MEMBERFUL_WEBHOOK_SECRET`. If your plans aren't named Passion and Devout, set `MEMBERFUL_PASSION_PLAN` and `MEMBERFUL_DEVOUT_PLAN` to their names or IDs.
5. Redeploy. Use Memberful's **Send test** on the webhook, then check Supabase **Table Editor > memberships** for the test member.

Members sign in under **My study** on the Bible page with the same email they joined with. Until these steps are done, the Bible works for everyone and the member tools say they're coming soon.

## 6. Partnerships, press and licensing

The /partnerships, /press and /licensing pages each have a form. Messages are saved under **Messages** in WordPress and emailed to `partnerships@`, `press@` and `licensing@thereyouarejesus.com`. Change those addresses in **Site Settings > Connection** (and the `PUBLIC_*_EMAIL` variables in Vercel, which are shown on the pages). Install the updated plugin zip (version 1.1) for the routing to work.

Press coverage: add items to `coverage` in `src/data/defaults.ts`, or publish posts in a WordPress category named **Press** or **In the News** and they appear automatically.

## 7. The store

Products, prices, sizes and descriptions live in `src/data/store.ts`. Photos go in `public/store/` (see the README there). The store has its own page (/store), a page per product, a cart on every page, and checkout through Stripe.

1. In Stripe, go to **Developers > API keys** and copy the **secret key** into Vercel as `STRIPE_SECRET_KEY`. Start with the test key (`sk_test_...`) and test card `4242 4242 4242 4242`; switch to the live key when you're ready.
2. In Stripe, go to **Developers > Webhooks > Add endpoint**: `https://thereyouarejesus.com/api/stripe/webhook`, event `checkout.session.completed`. Copy its signing secret into Vercel as `STRIPE_WEBHOOK_SECRET`. Each order is then saved under **Messages** in WordPress and emailed to the **Store orders** address in Site Settings (plugin version 1.2).
3. Set `STORE_SHIPPING_CENTS` (flat shipping per order) and `STORE_SHIP_COUNTRIES`. To have Stripe add sales tax, turn on Stripe Tax and set `STRIPE_AUTOMATIC_TAX=true`.
4. Digital products: upload the file somewhere private (for example a Google Drive or Dropbox link) and set `DOWNLOAD_TRAIL_OF_SEVENS_GUIDE` to that link. Buyers see a Download button on the thank-you page after payment.
5. Member discount: in Stripe, create a **promotion code** (Products > Coupons) for 15% off and share it with Devout members. Checkout has a box for codes.

Fulfillment: physical orders arrive by email with the shipping address. Place them with your print-on-demand provider (such as Printful) or ship them yourself. Until `STRIPE_SECRET_KEY` is set, the checkout button says the store opens soon.

## 8. Go live (cutover)

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
src/pages/api/radio/              Featured stations and "now playing" info (src/lib/radio.ts)
src/pages/radio/                  Full Christian radio directory page; directory.json is built at each deploy
src/pages/podcasts/               Discover Christian podcasts page
src/pages/api/podcasts/           Podcast charts, search and show details (src/lib/podcasts.ts)
src/pages/bible/                  Bible reader, search, study paths and member notes (src/lib/bible.ts, src/data/bible.ts)
src/pages/api/bible/              Bible chapters, passages and search
src/pages/api/memberful/          Memberful webhook that unlocks member study tools
src/pages/partnerships|press|licensing/  Inquiry pages
supabase/schema.sql               Member accounts and study notes
src/pages/store/                  Store, product pages and order confirmation (catalog in src/data/store.ts)
src/pages/api/checkout/, api/stripe/  Stripe checkout, order lookup and payment webhook
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
