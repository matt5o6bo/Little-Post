import { getAdminUser } from '../../admin-auth';
import { json, mailboxFor, storage } from '../../lib/mail';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const shared = new URL(request.url).searchParams.has('key');
    const user = await getAdminUser();
    const mailbox = await mailboxFor(request);
    if (shared && !mailbox) return json({ error: 'This mailbox link is not available. Ask the sender for their latest link.' }, 404);
    const rows = mailbox ? (await storage().db.prepare('SELECT * FROM letters WHERE mailbox_id = ? ORDER BY created_at DESC').bind(mailbox.id).all()).results : [];
    return json({ signedIn: !!user, canEdit: !!user && !shared, shareKey: !shared ? mailbox?.share_key : undefined, letters: rows.map(row => ({ ...row, media: JSON.parse(row.media as string) })) });
  } catch { return json({ error: 'We could not load the mailbox. Please try again.' }, 503); }
}
