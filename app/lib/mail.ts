import { env } from 'cloudflare:workers';
import { getAdminUser } from '../admin-auth';
export function storage() {
  if (!env.DB || !env.BUCKET) throw new Error('Letter storage is unavailable. Please try again shortly.');
  return { db: env.DB, bucket: env.BUCKET };
}
export type Mailbox = { id: string; owner_id: string; share_key: string };
export type Media = { id: string; name: string; type: string; size: number };
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }); }
export async function mailboxFor(request: Request): Promise<Mailbox | null> {
  const { db } = storage();
  const key = new URL(request.url).searchParams.get('key');
  if (key) return db.prepare('SELECT * FROM mailboxes WHERE share_key = ?').bind(key).first<Mailbox>();
  const user = await getAdminUser();
  if (!user) return null;
  return db.prepare('SELECT * FROM mailboxes WHERE owner_id = ?').bind(user.userId).first<Mailbox>();
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin;
}
export async function ensureMailbox(userId: string) {
  const { db } = storage();
  await db.prepare('INSERT OR IGNORE INTO mailboxes (id, owner_id, share_key) VALUES (?, ?, ?)').bind(crypto.randomUUID(), userId, crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')).run();
  return (await db.prepare('SELECT * FROM mailboxes WHERE owner_id = ?').bind(userId).first<Mailbox>())!;
}
