import { env } from 'cloudflare:workers';
import { cookieHeader, sessionToken, sha256 } from '../../../admin-auth';
import { json, sameOrigin } from '../../../lib/mail';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request not allowed.' }, 403);
  const token = sessionToken(request.headers.get('cookie'));
  if (token && env.DB) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': cookieHeader('', 0), 'Cache-Control': 'no-store' } });
}
