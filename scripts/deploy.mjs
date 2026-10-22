import { cf, requireAccount, runNode } from './cloudflare-cli.mjs';
const c = requireAccount();
console.log(`Deploying ${c.name} to your configured Cloudflare account ${c.account_id}.`);
runNode('node_modules/typescript/bin/tsc', ['--noEmit']);
runNode('node_modules/vinext/dist/cli.js', ['build']);
cf(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', 'wrangler.json']);
cf(['deploy', '--config', 'dist/server/wrangler.json']);
console.log('For first-time setup, run npm run admin:setup next. Without an admin key, uploads remain locked.');
