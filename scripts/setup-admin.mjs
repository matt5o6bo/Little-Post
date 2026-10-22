import { createInterface } from 'node:readline/promises';
import { randomBytes, createHash } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { cf, requireAccount, root } from './cloudflare-cli.mjs';
const local = process.argv.includes('--local');
if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run this command yourself in a private Terminal. It displays your new admin key; do not run it in chat or share the output.');
if (!local) requireAccount();
const rl = createInterface({ input: process.stdin, output: process.stdout });
try {
  console.log(local ? 'Setting up LOCAL development access only.' : 'This creates or rotates your Little Post admin key. Rotation also invalidates existing admin sessions.');
  const key = 'lp_admin_' + randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(key).digest('hex');
  console.log('\nSave this key as your Little Post password in your password manager:\n\n' + key + '\n');
  const answer = await rl.question('Type SAVED after saving it (anything else cancels without changing access): ');
  if (answer !== 'SAVED') throw new Error('Cancelled. Existing admin access was not changed.');
  if (local) {
    const path = root + '.dev.vars';
    const previous = existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(line => !/^\s*ADMIN_KEY_SHA256\s*=/.test(line)).join('\n').trimEnd() : '';
    writeFileSync(path, (previous ? previous + '\n' : '') + 'ADMIN_KEY_SHA256=' + hash + '\n', { mode: 0o600 });
    chmodSync(path, 0o600);
    console.log('Local login configured. Restart your local dev server, then open /admin.');
  } else {
    cf(['secret', 'put', 'ADMIN_KEY_SHA256', '--config', 'wrangler.json'], { input: hash + '\n' });
    console.log('Admin key configured. Visit your deployed app, choose Add a letter, and use the saved key.');
  }
} finally { rl.close(); }
