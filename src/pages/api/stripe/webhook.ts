import type { APIRoute } from 'astro';
import { PRODUCTS } from '../../../data/store';
import { verifyStripe } from '../../../lib/stripe';
import { WP_URL } from '../../../lib/wp';

export const prerender = false;

// When a payment completes, Stripe tells us here. The order is saved in WordPress (Messages) and emailed for fulfillment.
export const POST: APIRoute = async ({ request }) => {
  const payload = await request.text();
  const secret = import.meta.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !verifyStripe(payload, request.headers.get('stripe-signature') || '', secret)) return new Response('Bad signature', { status: 400 });
  const event = JSON.parse(payload);
  if (event.type !== 'checkout.session.completed') return new Response('ignored');
  const s = event.data.object;
  const lines = String(s.metadata?.items || '').split('|').filter(Boolean).map((row: string) => {
    const [pid, option, qty] = row.split('~');
    const p = PRODUCTS.find((x) => x.id === pid);
    return `${qty} × ${p?.name || pid}${option ? ` (${option})` : ''}${p?.digital ? ' [digital, delivered automatically]' : ''}`;
  });
  const ship = s.shipping_details || s.collected_information?.shipping_details;
  const addr = ship?.address ? [ship.name, ship.address.line1, ship.address.line2, `${ship.address.city || ''}, ${ship.address.state || ''} ${ship.address.postal_code || ''}`, ship.address.country].filter(Boolean).join('\n') : '';
  const message = [
    `New store order: $${((s.amount_total || 0) / 100).toFixed(2)}`, '', ...lines, '',
    addr ? `Ship to:\n${addr}` : 'No shipping needed (digital only).',
    s.customer_details?.phone ? `Phone: ${s.customer_details.phone}` : '',
    '', `Stripe payment: https://dashboard.stripe.com/payments/${s.payment_intent || ''}`,
  ].filter((l) => l !== undefined).join('\n');

  const secretWp = import.meta.env.TYAJ_FORM_SECRET;
  if (secretWp) {
    await fetch(`${WP_URL}/wp-json/tyaj/v1/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TYAJ-Secret': secretWp },
      body: JSON.stringify({ topic: 'order', name: s.customer_details?.name || 'Customer', email: s.customer_details?.email || 'unknown@example.com', message, perm: 'private' }),
    }).catch(() => {});
  }
  return new Response('ok');
};
