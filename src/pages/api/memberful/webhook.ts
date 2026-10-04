import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const prerender = false;

// Memberful calls this when someone joins, changes plan, renews or cancels.
// It records each member's level (free, passion, devout) in Supabase so Bible study tools unlock for them.
const env = import.meta.env;
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

function planTier(plan: any): 'passion' | 'devout' | null {
  const ids = [norm(plan?.id), norm(plan?.slug), norm(plan?.name)];
  const devout = norm(env.MEMBERFUL_DEVOUT_PLAN || 'devout'), passion = norm(env.MEMBERFUL_PASSION_PLAN || 'passion');
  if (ids.some((v) => v && (v === devout || v.includes('devout')))) return 'devout';
  if (ids.some((v) => v && (v === passion || v.includes('passion')))) return 'passion';
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const secret = env.MEMBERFUL_WEBHOOK_SECRET;
  const sig = request.headers.get('x-memberful-webhook-signature') || '';
  if (!secret) return new Response('Webhook secret not set', { status: 503 });
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return new Response('Bad signature', { status: 401 });

  let d: any;
  try { d = JSON.parse(body); } catch { return new Response('Bad JSON', { status: 400 }); }
  const member = d.member || d.subscription?.member || d.order?.member || {};
  const email = norm(member.email);
  if (!email) return new Response('No member email', { status: 200 });

  // Work out the highest active plan from whatever the event includes.
  const subs: any[] = [...(member.subscriptions || []), ...(d.subscription ? [d.subscription] : []), ...(d.order?.subscriptions || [])];
  let tier: 'free' | 'passion' | 'devout' = 'free';
  for (const s of subs) {
    const active = s.active !== false && !s.expired && !/deactivated|deleted|expired/.test(norm(d.event));
    const t = active ? planTier(s.subscription_plan || s.plan) : null;
    if (t === 'devout') tier = 'devout'; else if (t === 'passion' && tier === 'free') tier = 'passion';
  }

  const url = env.PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response('Supabase not configured', { status: 503 });
  const res = await fetch(`${url}/rest/v1/memberships`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ email, tier, updated_at: new Date().toISOString() }),
  });
  return new Response(res.ok ? 'ok' : 'Could not save membership', { status: res.ok ? 200 : 502 });
};
