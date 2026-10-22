import { headers } from 'next/headers';
import { env } from 'cloudflare:workers';
export const COOKIE = '__Host-little_post_session';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function sessionToken(cookie: string | null) {
  const value = cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
}
export function configuredHash() {
  return env.ADMIN_KEY_SHA256 && /^[a-f0-9]{64}$/.test(env.ADMIN_KEY_SHA256) ? env.ADMIN_KEY_SHA256 : null;
}
export function equalHash(left: string, right: string) {
  if (left.length !== 64 || right.length !== 64) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}
export async function getAdminUser() {
  const hash = configuredHash();
  if (!hash || !env.DB) return null;
  const token = sessionToken((await headers()).get('cookie'));
  if (!token) return null;
  const session = await env.DB.prepare('SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND credential_version = ? AND expires_at > ?').bind(await sha256(token), hash, Math.floor(Date.now() / 1000)).first();
  return session ? { userId: 'little-post-owner' } : null;
}
export function cookieHeader(token: string, age = SESSION_SECONDS) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}
