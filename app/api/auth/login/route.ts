import { env } from 'cloudflare:workers';
import { json, sameOrigin } from '../../../lib/mail';
import { configuredHash, cookieHeader, equalHash, randomToken, SESSION_SECONDS, sessionToken, sha256 } from '../../../admin-auth';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Please sign in from this website.' }, 403);
  const expected = configuredHash();
  if (!expected || !env.DB) return json({ error: 'Admin access is not configured. Run the admin setup command from your project folder.' }, 503);
  try {
    const now = Math.floor(Date.now() / 1000);
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    const attemptKey = await sha256(expected + ':' + ip) + ':' + Math.floor(now / 60);
    await env.DB.prepare('DELETE FROM login_attempts WHERE expires_at < ?').bind(now).run();
    const attempt = await env.DB.prepare('INSERT INTO login_attempts (id, hits, expires_at) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET hits = hits + 1 RETURNING hits').bind(attemptKey, now + 120).first<{ hits: number }>();
    if (!attempt || attempt.hits > 10) return json({ error: 'Too many attempts. Wait a minute, then try again.' }, 429);
    if (Number(request.headers.get('content-length')) > 2048) return json({ error: 'Invalid login request.' }, 400);
    if (!request.body) return json({ error: 'Enter your admin key.' }, 400);
    let length = 0;
    const bounded = request.body.pipeThrough(new TransformStream({ transform(chunk, controller) { length += chunk.byteLength; if (length > 2048) throw new Error('Login too large'); controller.enqueue(chunk); } }));
    let body: { key?: unknown };
    try { body = await new Response(bounded).json() as { key?: unknown }; } catch { return json({ error: 'Invalid login request.' }, 400); }
    const key = typeof body?.key === 'string' ? body.key.trim() : '';
    if (key.length < 40 || key.length > 256 || !equalHash(await sha256(key), expected)) return json({ error: 'That admin key did not match.' }, 401);
    const previous = sessionToken(request.headers.get('cookie'));
    if (previous) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256(previous)).run();
    await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ? OR credential_version != ?').bind(now, expected).run();
    const token = randomToken();
    await env.DB.prepare('INSERT INTO admin_sessions (token_hash, credential_version, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), expected, now + SESSION_SECONDS).run();
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': cookieHeader(token), 'Cache-Control': 'no-store' } });
  } catch { return json({ error: 'Sign-in is temporarily unavailable. Please try again.' }, 503); }
}
