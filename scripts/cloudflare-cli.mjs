import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
export function config() { return JSON.parse(readFileSync(new URL('../wrangler.json', import.meta.url), 'utf8')); }
export function saveConfig(value) {
  const path = fileURLToPath(new URL('../wrangler.json', import.meta.url));
  writeFileSync(path + '.tmp', JSON.stringify(value, null, 2) + '\n'); renameSync(path + '.tmp', path);
}
export function cf(args, { capture = false, input, accountId } = {}) {
  const account = accountId || config().account_id;
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', ...(account ? { CLOUDFLARE_ACCOUNT_ID: account } : {}) },
    stdio: capture ? ['pipe', 'pipe', 'pipe'] : input !== undefined ? ['pipe', 'inherit', 'inherit'] : 'inherit', input,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr || result.stdout || 'Cloudflare command failed.\n');
    throw new Error(`Cloudflare command failed: ${args.slice(0, 3).join(' ')}. Resolve the reported issue and run the command again.`);
  }
  return result.stdout || '';
}
export function runNode(relative, args = []) {
  const result = spawnSync(process.execPath, [relative, ...args], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${relative} failed. Deployment stopped.`);
}
export function requireAccount() {
  const c = config();
  if (!c.account_id || c.d1_databases[0].database_id === '00000000-0000-4000-8000-000000000000') throw new Error('Run npm run setup:cloudflare first.');
  const identity = JSON.parse(cf(['whoami', '--json'], { capture: true }));
  if (!identity.accounts?.some(a => a.id === c.account_id)) throw new Error('The signed-in account does not match wrangler.json. Sign in to the selected personal account.');
  return c;
}
