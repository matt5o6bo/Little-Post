import { createInterface } from 'node:readline/promises';
import { randomBytes } from 'node:crypto';
import { cf, config, saveConfig } from './cloudflare-cli.mjs';
if (!process.stdin.isTTY) throw new Error('Run this setup yourself in Terminal so you can select your personal account.');
const rl = createInterface({ input: process.stdin, output: process.stdout });
try {
  let identity;
  try { identity = JSON.parse(cf(['whoami', '--json'], { capture: true })); }
  catch { console.log('First run npm run login:cloudflare and complete the Cloudflare browser sign-in.'); process.exitCode = 1; }
  if (identity) {
    if (!identity.accounts?.length) throw new Error('No Cloudflare accounts are available. Create your personal account first.');
    console.log(`Signed in as ${identity.email || 'your Cloudflare user'}. Choose your PERSONAL account:`);
    identity.accounts.forEach((a,i) => console.log(`${i+1}. ${a.name} (${a.id})`));
    const selected = Number(await rl.question('Account number: ')) - 1;
    if (!Number.isInteger(selected) || !identity.accounts[selected]) throw new Error('No valid account selected; nothing created.');
    const account = identity.accounts[selected], c = config();
    if (c.account_id && c.account_id !== account.id) throw new Error('This copy is already configured for a different account. Make a new copy to change accounts.');
    if (!c.account_id) {
      const proposed = 'little-post-' + randomBytes(3).toString('hex');
      const name = (await rl.question(`App name [${proposed}]: `)).trim() || proposed;
      if (!/^[a-z][a-z0-9-]{2,39}$/.test(name) || name.endsWith('-')) throw new Error('Use 3–40 lowercase letters, numbers, or hyphens; start with a letter.');
      c.account_id = account.id; c.name = name; c.d1_databases[0].database_name = name + '-db'; c.r2_buckets[0].bucket_name = name + '-media';
      const existing = JSON.parse(cf(['d1', 'list', '--json'], { capture: true, accountId: account.id }));
      if (existing.some(d => d.name === c.d1_databases[0].database_name)) throw new Error('That database name already exists. Choose another app name to avoid modifying unrelated data.');
      saveConfig(c);
    }
    console.log(`Preparing ${c.name} in ${account.name}. R2 must be enabled in your account; Cloudflare may require billing setup.`);
    const dbName = c.d1_databases[0].database_name;
    let databases = JSON.parse(cf(['d1', 'list', '--json'], { capture: true }));
    let database = databases.find(d => d.name === dbName);
    if (!database) { cf(['d1', 'create', dbName, '--no-update-config', '--config', 'wrangler.json']); databases = JSON.parse(cf(['d1', 'list', '--json'], { capture: true })); database = databases.find(d => d.name === dbName); }
    if (!database?.uuid) throw new Error('Database creation could not be confirmed. Re-run setup to reconcile it.');
    c.d1_databases[0].database_id = database.uuid; saveConfig(c);
    const bucketName = c.r2_buckets[0].bucket_name;
    const bucketOutput = cf(['r2', 'bucket', 'list'], { capture: true });
    const bucketNames = [...bucketOutput.matchAll(/^\s*name:\s+(\S+)\s*$/gm)].map(m => m[1]);
    if (!bucketNames.includes(bucketName)) cf(['r2', 'bucket', 'create', bucketName]);
    cf(['r2', 'bucket', 'info', bucketName]);
    console.log('\nStorage configured. Next: npm run deploy, then npm run admin:setup.');
  }
} finally { rl.close(); }
