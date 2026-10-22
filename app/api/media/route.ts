import { json, mailboxFor, storage, type Media } from '../../lib/mail';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const mailbox = await mailboxFor(request);
  if (!mailbox) return json({ error: 'Media not found.' }, 404);
  const url = new URL(request.url), letter = url.searchParams.get('letter'), id = url.searchParams.get('id');
  const { db, bucket } = storage();
  const row = await db.prepare('SELECT media FROM letters WHERE id = ? AND mailbox_id = ?').bind(letter, mailbox.id).first<{ media: string }>();
  const media = row && (JSON.parse(row.media) as Media[]).find(m => m.id === id);
  if (!media) return json({ error: 'Media not found.' }, 404);
  const range = request.headers.get('range');
  if (range && !/^bytes=\d*-\d*$/.test(range)) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${media.size}` } });
  let object;
  try { object = await bucket.get(`${mailbox.id}/${letter}/${id}`, range ? { range: request.headers } : undefined); }
  catch { return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${media.size}` } }); }
  if (!object) return json({ error: 'Media not found.' }, 404);
  const headers = new Headers({ 'Content-Type': media.type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', 'Referrer-Policy': 'no-referrer' });
  let status = 200;
  if (range && object.range && 'offset' in object.range && object.range.offset !== undefined) {
    const offset = object.range.offset, length = object.range.length ?? object.size - offset;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`); headers.set('Content-Length', String(length)); status = 206;
  } else { headers.set('Content-Length', String(object.size)); }
  return new Response(object.body, { status, headers });
}
