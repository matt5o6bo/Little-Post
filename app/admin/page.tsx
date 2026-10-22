'use client';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
export default function Admin() {
  const [key, setKey] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not sign in.');
      setKey(''); location.assign('/');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); setBusy(false); }
  }
  return <main className="admin-page"><a className="brand" href="/"><Mail size={24}/>little post</a><section className="admin-card"><KeyRound size={26}/><span className="eyebrow">SENDER ACCESS</span><h1>Your side of the mailbox.</h1><p>Sign in to add letters and manage your mailbox. Your friend only needs the recipient link.</p><form onSubmit={signIn}><label>Admin key<input type="password" name="password" autoComplete="current-password" required minLength={40} maxLength={256} value={key} onChange={e => setKey(e.target.value)} placeholder="Your saved Little Post admin key" disabled={busy}/></label>{error && <p className="error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Open my mailbox'}</button></form><small>Your admin key is generated during setup. Store it in your password manager.</small><a href="/" className="text-link"><ArrowLeft size={15}/>Back to Little Post</a></section></main>;
}
