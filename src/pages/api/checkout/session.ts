import type { APIRoute } from 'astro';
import { PRODUCTS } from '../../../data/store';
import { stripe, stripeReady } from '../../../lib/stripe';

export const prerender = false;

// Order confirmation, plus download links for digital items once payment has gone through.
export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id') || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (!stripeReady() || !/^cs_[A-Za-z0-9_]+$/.test(id)) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers });
  try {
    const s = await stripe(`checkout/sessions/${id}`);
    const paid = s.payment_status === 'paid' || s.payment_status === 'no_payment_required';
    const items = String(s.metadata?.items || '').split('|').filter(Boolean).map((row) => {
      const [pid, option, qty] = row.split('~');
      const p = PRODUCTS.find((x) => x.id === pid);
      const envKey = `DOWNLOAD_${pid.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      return {
        name: p ? p.name : pid, option, qty: Number(qty) || 1, digital: !!p?.digital,
        download: paid && p?.digital ? (import.meta.env as Record<string, string | undefined>)[envKey] || '' : '',
      };
    });
    return new Response(JSON.stringify({
      paid, email: s.customer_details?.email || '', name: s.customer_details?.name || '', total: s.amount_total || 0, items,
    }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: "We couldn't look up this order." }), { status: 502, headers });
  }
};
