import { getDirectory } from '../../lib/radio';

// Built once per deploy: every Christian station in the directory with a secure stream.
export async function GET() {
  let stations: unknown[] = [];
  try { stations = await getDirectory(); } catch (e) { console.warn('[tyaj] Radio directory unavailable at build:', (e as Error).message); }
  return new Response(JSON.stringify({ built: new Date().toISOString(), stations }), { headers: { 'Content-Type': 'application/json' } });
}
