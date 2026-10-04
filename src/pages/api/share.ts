import type { APIRoute } from 'astro';
import { WP_URL } from '../../lib/wp';

export const prerender = false;

const TOPICS = ['question', 'story', 'guest', 'prayer', 'feedback', 'partnership', 'press', 'licensing'];
const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

// Receives the Share Your Thoughts form and saves it in WordPress (Messages), which also emails John.
export const POST: APIRoute = async ({ request }) => {
  let d: Record<string, unknown>;
  try { d = await request.json(); } catch { return json({ error: 'The form data could not be read. Refresh the page and try again.' }, 400); }

  // Spam checks: hidden field must stay empty, and the form must have been open at least 3 seconds.
  if (str(d.website) || Date.now() - Number(d.started || 0) < 3000) return json({ ok: true });

  const msg = {
    topic: str(d.topic, 20), name: str(d.name, 120), email: str(d.email, 200), location: str(d.location, 120),
    kind: str(d.kind, 60), when: str(d.when, 20), phone: str(d.phone, 40), record: d.record === 'yes',
    post: str(d.post, 300), message: str(d.message, 10000), perm: ['prayer', 'partnership', 'press', 'licensing'].includes(String(d.topic)) ? 'private' : str(d.perm, 20),
    subscribe: d.subscribe === 'yes',
    organization: str(d.organization, 160), org_url: str(d.org_url, 200), deadline: str(d.deadline, 20),
  };
  if (!TOPICS.includes(msg.topic)) return json({ error: 'Choose a topic so we know how to help.' }, 400);
  if (!msg.name) return json({ error: 'Enter your name.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.email)) return json({ error: 'Enter a full email address, like you@example.com.' }, 400);
  if (!msg.message) return json({ error: 'Write a message before sending.' }, 400);

  const secret = import.meta.env.TYAJ_FORM_SECRET;
  if (!secret) return json({ error: 'The message form isn\'t connected yet. Email john@thereyouarejesus.com instead.' }, 503);

  try {
    const res = await fetch(`${WP_URL}/wp-json/tyaj/v1/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TYAJ-Secret': secret },
      body: JSON.stringify(msg),
    });
    if (!res.ok) throw new Error(String(res.status));
    return json({ ok: true });
  } catch {
    return json({ error: 'Your message didn\'t send because the site couldn\'t reach WordPress. Try again in a minute, or email john@thereyouarejesus.com.' }, 502);
  }
};
