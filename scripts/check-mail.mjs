import assert from 'node:assert/strict';
const base = process.env.LITTLE_POST_TEST_URL || 'http://localhost:5174';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('This disposable-data test must run on loopback only.');
const adminKey = process.env.LITTLE_POST_TEST_ADMIN_KEY || 'lp_admin_LOCAL_TEST_ONLY_012345678901234567890123456789';
const origin = { origin: base, 'Content-Type': 'application/json', 'cf-connecting-ip': '192.0.2.' + (1 + Math.floor(Math.random()*250)) };
const spoofed = await (await fetch(base + '/api/mailbox', { headers: { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': 'owner@example.com' } })).json();
assert.equal(spoofed.canEdit, false, 'Forged Sites identity headers must not authenticate');
const denied = await fetch(base + '/api/auth/login', { method: 'POST', headers: origin, body: JSON.stringify({ key: 'wrong' }) });
assert.equal(denied.status, 401);
assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: {...origin, origin: 'https://untrusted.example'}, body: JSON.stringify({ key: adminKey }) })).status, 403);
const auth = await fetch(base + '/api/auth/login', { method: 'POST', headers: origin, body: JSON.stringify({ key: adminKey }) });
assert.equal(auth.status, 200, await auth.clone().text());
const setCookie = auth.headers.get('set-cookie');
assert(setCookie?.includes('HttpOnly') && setCookie.includes('Secure') && setCookie.includes('SameSite=Strict'));
const cookie = setCookie.split(';')[0];
const headers = { cookie, origin: base };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
function letter(type = 'image/png') { const f = new FormData(); for (const [k,v] of Object.entries({title:'Disposable upload verification',recipient:'Test reader',sender:'Test sender',note:'Local test only.',date:'2026-10-22',color:'sage'})) f.set(k,v); f.append('files', new Blob([png], {type}), 'test.png'); return f; }
assert.equal((await fetch(base + '/api/letters', {method:'POST',headers:{origin:base},body:letter()})).status,401);
assert.equal((await fetch(base + '/api/letters', {method:'POST',headers:{...headers,origin:'https://untrusted.example'},body:letter()})).status,403);
assert.equal((await fetch(base + '/api/letters', {method:'POST',headers,body:letter('text/html')})).status,400);
const posted = await fetch(base + '/api/letters', {method:'POST',headers,body:letter()});
const post = await posted.json(); assert.equal(posted.status,201,JSON.stringify(post));
try {
 const own = await (await fetch(base + '/api/mailbox',{headers:{cookie}})).json();
 const created = own.letters.find(l=>l.id===post.id); assert(created); assert.equal(created.media.length,1); assert(own.canEdit); assert(own.shareKey);
 const shared = await (await fetch(base + '/api/mailbox?key='+own.shareKey)).json(); assert(shared.letters.some(l=>l.id===post.id)); assert.equal(shared.canEdit,false); assert.equal(shared.shareKey,undefined);
 assert.equal(shared.canUpload,true);
 const invalidUpload = await fetch(base+'/api/letters',{method:'POST',headers:{origin:base,'X-Mailbox-Key':'0'.repeat(64)},body:letter()}); assert.equal(invalidUpload.status,404);
 const sharedUpload = await fetch(base+'/api/letters',{method:'POST',headers:{origin:base,'X-Mailbox-Key':own.shareKey},body:letter()});
 assert.equal(sharedUpload.status,201,await sharedUpload.clone().text());
 const sharedPost = await sharedUpload.json();
 try {
  const received = await (await fetch(base+'/api/mailbox?key='+own.shareKey)).json(); assert(received.letters.some(l=>l.id===sharedPost.id));
  assert.equal((await fetch(base+'/api/letters?id='+sharedPost.id,{method:'DELETE',headers:origin})).status,401);
 } finally { assert.equal((await fetch(base+'/api/letters?id='+sharedPost.id,{method:'DELETE',headers})).status,200); }
 const anonymous = await (await fetch(base + '/api/mailbox')).json(); assert.equal(anonymous.letters.length,0);
 assert.equal((await fetch(base + '/api/mailbox?key=invalid')).status,404);
 const mediaUrl = base + `/api/media?letter=${post.id}&id=${created.media[0].id}&key=${own.shareKey}`;
 const media = await fetch(mediaUrl); assert.equal(media.status,200); assert.deepEqual(Buffer.from(await media.arrayBuffer()),png);
 const part = await fetch(mediaUrl,{headers:{Range:'bytes=0-9'}}); assert.equal(part.status,206); assert.equal(part.headers.get('content-range'),`bytes 0-9/${png.length}`); assert.deepEqual(Buffer.from(await part.arrayBuffer()),png.subarray(0,10));
 assert.equal((await fetch(mediaUrl.replace(own.shareKey,'invalid'))).status,404);
 assert.equal((await fetch(base+'/api/letters?id='+post.id,{method:'DELETE',headers:{origin:base}})).status,401);
 const removed=await fetch(base+'/api/letters?id='+post.id,{method:'DELETE',headers}); assert.equal(removed.status,200);
 assert.equal((await fetch(mediaUrl)).status,404);
 const logout = await fetch(base + '/api/auth/logout', { method: 'POST', headers }); assert.equal(logout.status, 200);
 const afterLogout = await (await fetch(base + '/api/mailbox', { headers: { cookie } })).json(); assert.equal(afterLogout.canEdit, false);
 for (let i = 0; i < 11; i++) { const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { ...origin, 'cf-connecting-ip': '198.51.100.' + origin['cf-connecting-ip'].split('.').at(-1) }, body: JSON.stringify({ key: 'wrong' }) }); if (i === 10) assert.equal(response.status, 429); }
 console.log('PASS: admin-key login; spoofed identity rejection; secure cookie; logout revocation; login rate limiting; authenticated and link-based uploads; persistence; image round-trip; ranged media; recipient read access without deletion; missing/invalid key protection; origin checks; file-type validation; deletion and media revocation.');
} finally { await fetch(base+'/api/letters?id='+post.id,{method:'DELETE',headers}); }
