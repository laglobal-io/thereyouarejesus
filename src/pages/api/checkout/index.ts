import type { APIRoute } from 'astro';
import { PRODUCTS, priceOf } from '../../../data/store';
import { stripe, stripeReady } from '../../../lib/stripe';

export const prerender = false;
const json = (b: object, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

// Creates a Stripe Checkout page for the cart. Prices always come from the catalog, never from the browser.
export const POST: APIRoute = async ({ request, url }) => {
  if (!stripeReady()) return json({ error: 'Checkout opens soon. Please check back shortly.' }, 503);
  let items: { id: string; option?: string; qty: number }[] = [];
  try { items = (await request.json()).items || []; } catch { return json({ error: 'Your cart could not be read. Refresh the page and try again.' }, 400); }
  const lines = items.slice(0, 30).map((it) => {
    const p = PRODUCTS.find((x) => x.id === it.id);
    if (!p || (p.options && !p.options.some((o) => o.label === it.option))) return null;
    return { p, option: p.options ? it.option : undefined, qty: p.digital ? 1 : Math.max(1, Math.min(20, Math.floor(Number(it.qty) || 1))) };
  }).filter(Boolean) as { p: (typeof PRODUCTS)[number]; option?: string; qty: number }[];
  if (!lines.length) return json({ error: 'Your cart is empty.' }, 400);

  const origin = url.origin;
  const f = new URLSearchParams();
  f.set('mode', 'payment');
  f.set('success_url', `${origin}/store/thanks/?session_id={CHECKOUT_SESSION_ID}`);
  f.set('cancel_url', `${origin}/store/?checkout=cancelled`);
  f.set('allow_promotion_codes', 'true');
  f.set('billing_address_collection', 'auto');
  lines.forEach((l, i) => {
    const k = `line_items[${i}]`;
    f.set(`${k}[quantity]`, String(l.qty));
    f.set(`${k}[price_data][currency]`, 'usd');
    f.set(`${k}[price_data][unit_amount]`, String(priceOf(l.p, l.option)));
    f.set(`${k}[price_data][product_data][name]`, l.option ? `${l.p.name} (${l.option})` : l.p.name);
    f.set(`${k}[price_data][product_data][description]`, l.p.blurb);
    f.set(`${k}[price_data][product_data][metadata][product_id]`, l.p.id);
  });
  // Compact record of the order for confirmation and fulfillment (Stripe allows 500 characters).
  f.set('metadata[items]', lines.map((l) => `${l.p.id}~${l.option || ''}~${l.qty}`).join('|').slice(0, 500));

  if (lines.some((l) => !l.p.digital)) {
    const countries = (import.meta.env.STORE_SHIP_COUNTRIES || 'US,CA,GB,AU,NZ,IE').split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean);
    countries.forEach((c: string, i: number) => f.set(`shipping_address_collection[allowed_countries][${i}]`, c));
    const physical = lines.filter((l) => !l.p.digital).reduce((n, l) => n + priceOf(l.p, l.option) * l.qty, 0);
    const freeOver = Number(import.meta.env.PUBLIC_FREE_SHIPPING_CENTS || 5000);
    const free = freeOver > 0 && physical >= freeOver;
    f.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
    f.set('shipping_options[0][shipping_rate_data][display_name]', free ? 'Free shipping' : 'Standard shipping');
    f.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', free ? '0' : String(import.meta.env.STORE_SHIPPING_CENTS || 695));
    f.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');
    f.set('phone_number_collection[enabled]', 'true');
  }
  if (import.meta.env.STRIPE_AUTOMATIC_TAX === 'true') f.set('automatic_tax[enabled]', 'true');

  try {
    const session = await stripe('checkout/sessions', f);
    return json({ url: session.url });
  } catch (e) {
    console.error('[tyaj] checkout', (e as Error).message);
    return json({ error: "Checkout couldn't start right now. Try again in a minute." }, 502);
  }
};
