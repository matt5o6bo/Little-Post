import { getAdminUser } from '../../admin-auth';
import { ensureMailbox, json, sameOrigin, storage, type Mailbox, type Media } from '../../lib/mail';
export const dynamic = 'force-dynamic';
const MAX = 25 * 1024 * 1024;
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']);
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Please send letters from this website.' }, 403);
  const user = await getAdminUser();
  const key = request.headers.get('X-Mailbox-Key');
  if (!user && !key) return json({ error: 'Open your private mailbox link to add a letter.' }, 401);
  if (!user && !/^[a-f0-9]{64}$/.test(key || '')) return json({ error: 'This mailbox link is not available.' }, 404);
  const written: string[] = [];
  try {
    const { db, bucket } = storage();
    const mailbox = user
      ? await ensureMailbox(user.userId)
      : await db.prepare('SELECT * FROM mailboxes WHERE share_key = ?').bind(key).first<Mailbox>();
    if (!mailbox) return json({ error: 'This mailbox link is not available.' }, 404);
    if (Number(request.headers.get('content-length')) > MAX + 65536) return json({ error: 'Please keep each letter under 25 MB.' }, 413);
    // Bound streamed and chunked uploads without retaining an extra full-body copy.
    if (!request.body) return json({ error: 'The letter is empty.' }, 400);
    let length = 0;
    const bounded = request.body.pipeThrough(new TransformStream({
      transform(chunk, controller) {
        length += chunk.byteLength;
        if (length > MAX + 65536) throw new Error('UPLOAD_TOO_LARGE');
        controller.enqueue(chunk);
      },
    }));
    let form: FormData;
    try {
      form = await new Response(bounded, { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
    } catch {
      return json({ error: length > MAX + 65536 ? 'Please keep each letter under 25 MB.' : 'The upload was incomplete. Please try again.' }, length > MAX + 65536 ? 413 : 400);
    }
    const field = (name: string, max: number) => String(form.get(name) || '').trim().slice(0, max);
    const title = field('title', 100), recipient = field('recipient', 60), sender = field('sender', 60), note = field('note', 10000), date = field('date', 10);
    const color = ['rose', 'sage', 'cream'].includes(field('color', 10)) ? field('color', 10) : 'cream';
    const files = form.getAll('files').filter((v): v is File => typeof v !== 'string' && v.size > 0);
    if (!title || !recipient || !sender || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) return json({ error: 'Add a title, sender, recipient, and valid date.' }, 400);
    if (!note && !files.length) return json({ error: 'Add a note, a photo, or a video to your letter.' }, 400);
    if (files.length > 12 || files.some(f => !allowed.has(f.type)) || files.reduce((n, f) => n + f.size, 0) > MAX) return json({ error: 'Use up to 12 JPG, PNG, WebP, GIF, MP4, or WebM files, totaling 25 MB or less.' }, 400);
    const id = crypto.randomUUID(), media: Media[] = [];
    for (const file of files) {
      const mediaId = crypto.randomUUID(), key = `${mailbox.id}/${id}/${mediaId}`;
      await bucket.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      written.push(key); media.push({ id: mediaId, name: file.name.slice(0, 160), type: file.type, size: file.size });
    }
    await db.prepare('INSERT INTO letters (id, mailbox_id, title, recipient, sender, note, date, color, media, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, mailbox.id, title, recipient, sender, note, date, color, JSON.stringify(media), new Date().toISOString()).run();
    return json({ id }, 201);
  } catch { if (written.length) await storage().bucket.delete(written).catch(() => {}); return json({ error: 'Your letter could not be saved. Please try again.' }, 500); }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request not allowed.' }, 403);
  const user = await getAdminUser();
  if (!user) return json({ error: 'Sign in to remove a letter.' }, 401);
  const { db, bucket } = storage();
  const id = new URL(request.url).searchParams.get('id');
  const row = await db.prepare('SELECT letters.* FROM letters JOIN mailboxes ON letters.mailbox_id = mailboxes.id WHERE letters.id = ? AND mailboxes.owner_id = ?').bind(id, user.userId).first();
  if (!row) return json({ error: 'Letter not found.' }, 404);
  // Removing the row first immediately revokes access to its media.
  await db.prepare('DELETE FROM letters WHERE id = ?').bind(id).run();
  const media = JSON.parse(row.media as string) as Media[];
  if (media.length) await bucket.delete(media.map(m => `${row.mailbox_id}/${id}/${m.id}`));
  return json({ ok: true });
}
