# Little Post — personal Cloudflare edition

A standalone copy of the friends-and-pen-pals mailbox app. This copy does not use ChatGPT sign-in, Sites hosting, or the Datadog workspace. It keeps the mailbox, animated envelopes, photo/video uploads, and recipient links.

**Deployed to your personal Cloudflare account on October 22, 2026:** https://little-post.matt506bo.workers.dev. The Worker, D1 database, and private R2 bucket are provisioned, and both database migrations are applied. Sender-key setup is complete: the Cloudflare secret is present, and the live login endpoint rejects an invalid key without issuing a session. Open `/admin` and use your saved key to add letters.

Your original Sites project and its data have not been changed. This export contains source code and database schema, not existing letters or media. Existing content has not been migrated.

## Working from GitHub

This repository contains the personal Cloudflare edition at https://github.com/matt5o6bo/Little-Post. Clone it with:

```sh
git clone https://github.com/matt5o6bo/Little-Post.git
cd Little-Post
npm ci
```

The checked-in `wrangler.json` targets the existing Little Post deployment. Its account and resource IDs are not credentials; deployments still require access to that Cloudflare account. The admin key, Cloudflare credentials, letters, and uploaded media are not included. Publishing commits to GitHub does not deploy the website automatically; deployment remains an explicit `npm run deploy` step.

If you are the owner restoring this project on another computer, sign in with `npm run login:cloudflare` and use the existing configuration. You do not need to recreate storage or rotate your saved admin key. The account and storage setup sections below document the initial setup.

## 1. Create your personal account

1. Create and verify your account at https://dash.cloudflare.com/sign-up using your personal email.
2. In the dashboard, open **Storage & databases → R2 → Overview** and complete the R2 subscription setup yourself. R2 includes free monthly usage, but usage beyond the allowance can be billed. Review https://developers.cloudflare.com/r2/pricing/ before completing checkout. No paid Workers plan or purchased domain is required for the initial setup.
3. Use a Cloudflare `workers.dev` address first. If asked during deployment, select your account's workers.dev subdomain. You can connect your own domain later.

Cloudflare documentation:
- R2 setup: https://developers.cloudflare.com/r2/get-started/
- workers.dev addresses: https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- Framework deployment: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/

## 2. Install and sign in on your Mac

Use Node.js 22.13 or later. From this project folder in Terminal:

```sh
npm ci
npm run login:cloudflare
```

The login command opens Cloudflare's browser authorization flow. Sign in to your **personal** account and complete it yourself. Do not paste credentials, tokens, or an admin key into chat.

## 3. Configure your storage

```sh
npm run setup:cloudflare
```

Select your personal account by number and accept the generated app name or choose your own. The script:

- Records the selected account and app name in `wrangler.json`.
- Creates a D1 database for letters and sessions.
- Creates a private R2 bucket for uploaded media.
- Reuses the same resources on subsequent runs instead of creating another copy.

If R2 is not enabled, complete its setup in the Cloudflare dashboard and rerun this command. Do not enable an R2 public bucket URL: the app serves media only after checking the recipient key or your admin session.

Account IDs and resource IDs are configuration, not passwords. They are included in later exports. Do not change the configured account to a different account without preparing a new copy.

## 4. Publish, then set up your sender login

```sh
npm run deploy
npm run admin:setup
```

`deploy` checks TypeScript, builds the app, applies schema migrations, and publishes to your account. The first publication shows sample letters; creating letters is locked until an admin key is configured. The terminal prints the deployed address.

Run `admin:setup` yourself in a private Terminal. It generates a random admin key and shows it once. Save it in your password manager, then type `SAVED`. Only its SHA-256 digest is stored as a Cloudflare Worker secret. The plaintext key is never written into application source or an export.

Visit the deployed website → **Add a letter** and enter the saved admin key. Use it like a password. It is distinct from your Cloudflare password and from the recipient link. Your session lasts up to seven days; **Sign out** revokes that session immediately. Running `admin:setup` again rotates the key and invalidates existing sessions.

If you cancel before typing `SAVED`, existing access is not changed. Never run admin setup through an AI tool that would capture its output.

## 5. Send your first letter

1. Add a title, recipient, sender, date, and photos, videos, or an optional note.
2. Choose **Put in mailbox**. Each letter accepts up to 12 JPG, PNG, WebP, GIF, MP4, or WebM files totaling 25 MB.
3. Choose **Share mailbox** and copy the recipient link.
4. Test that link in a private browser window before sending it to your friend.

The recipient does not need an account. Anyone with that link can read the mailbox, so share it only with your intended reader. They cannot upload or delete letters. Keep the admin key private. The root URL alone does not expose your letters.

For broadly compatible videos, use H.264 MP4. Real media decoding and mobile-device playback should be checked with your own files.

## Updates and backups

After editing source, run `npm run deploy`. It keeps the same storage and admin secret. For source changes that alter the schema, generate a new migration with `npm run db:generate`; never rewrite an applied migration.

`npm run export` creates `outputs/little-post-cloudflare.zip`, excluding installed dependencies, runtime databases, uploads, local secrets, sessions, and build output. The ZIP is a source export, not a backup of letters. Back up D1 records and the R2 bucket separately when you have real correspondence.

To attach a domain later, open your Worker in Cloudflare → Settings → Domains & Routes. Preserve your database, bucket, and admin secret. Use only your own domain.

## Local development and verification

```sh
npm ci
npm run db:local
npm run admin:setup -- --local
npm run dev
```

Use the printed local URL, normally http://localhost:5174. The local admin command writes only a key digest to ignored `.dev.vars`; restart the dev server after changing it. Local storage is isolated from production. Local content is not automatically uploaded to Cloudflare.

Checks:

```sh
npm run check
npm run build
```

The integration script is restricted to loopback URLs and uses disposable letters. It verifies admin login, forged Sites-header rejection, secure session cookies, logout revocation, login rate limiting, uploads, persistence, image retrieval, range downloads, recipient access, invalid links, origin checks, file-type rejection, and deletion. For automated development only, configure the documented test key in `scripts/check-mail.mjs` as a local digest, or supply `LITTLE_POST_TEST_ADMIN_KEY` through a private test runner. Never configure that test key in production.

Validated here: TypeScript, production build, local migrations, local API integration checks, Cloudflare OAuth, live storage provisioning, remote migrations, deployment, and sender-secret presence. Live HTTP checks passed for the homepage, admin page, CSS assets, database reads, anonymous-write protection, invalid recipient links, forged identity-header rejection, cross-origin login rejection, and invalid admin-key rejection. Successful production sender login and uploads still need a user check with the saved private key. Real video decoding and mobile-device playback remain unverified.

## Implementation

- React + Vinext with Cloudflare's Vite plugin.
- Worker API routes, D1 metadata, and a private R2 bucket.
- One sender account with a generated 256-bit admin key; only its digest is stored as a Worker secret.
- Random session cookies (`HttpOnly`, `Secure`, `SameSite=Strict`) with hashed tokens and expiry in D1.
- Same-origin mutation checks and ten login attempts per IP per minute.
- Random, read-only recipient keys; no public mailbox listing.
- No dependency on trusted `oai-authenticated-*` headers.

The Cloudflare account controls billing, deployment, and data. Its account recovery is also how you recover a lost admin key by generating a new one.
