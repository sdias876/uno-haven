// Where Ek Haven keeps player accounts.
// - With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set: a free Upstash Redis database (survives restarts
//   on Render's free plan). Same approach as Spade Haven.
// - With DATA_DIR set (a Render disk): JSON files there.
// - Neither: accounts are switched off (the free server forgets files when it restarts, so sign-up stays hidden).
import fs from 'node:fs';
import path from 'node:path';

const clean = v => String(v || '').trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();
const fixUrl = v => { const u = clean(v).replace(/\s+/g, '').replace(/\/+$/, ''); return !u ? '' : /^https?:\/\//i.test(u) ? u : `https://${u}`; };
const UP_URL = fixUrl(process.env.UPSTASH_REDIS_REST_URL);
const UP_TOKEN = clean(process.env.UPSTASH_REDIS_REST_TOKEN).replace(/\s+/g, '');
const DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : '';
const PREFIX = 'ek-haven:';
const kind = UP_URL && UP_TOKEN ? 'upstash' : DIR ? 'files' : 'none';
if (kind === 'upstash') { let host = UP_URL; try { host = new URL(UP_URL).host; } catch (e) { /* keep */ } console.log(`accounts: Upstash database ${host}`); }
else if (kind === 'files') console.log(`accounts: files in ${DIR}`);
else console.log('accounts: off (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to turn on email sign-up)');

async function redis(cmd) {
  const r = await fetch(UP_URL, {method: 'POST', headers: {authorization: `Bearer ${UP_TOKEN}`, 'content-type': 'application/json'}, body: JSON.stringify(cmd)});
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `Upstash HTTP ${r.status}`);
  return j.result;
}
const safe = k => String(k).replace(/[^a-zA-Z0-9_-]/g, '');
async function getRecord(key) {
  if (kind === 'upstash') { const v = await redis(['GET', PREFIX + key]); return typeof v === 'string' ? JSON.parse(v) : null; }
  if (kind === 'files') { const f = path.join(DIR, safe(key) + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
  return null;
}
async function putRecord(key, value) {
  const data = JSON.stringify(value);
  if (kind === 'upstash') return redis(['SET', PREFIX + key, data]);
  if (kind === 'files') { fs.mkdirSync(DIR, {recursive: true}); const f = path.join(DIR, safe(key) + '.json'); fs.writeFileSync(f + '.tmp', data); fs.renameSync(f + '.tmp', f); }
}
// Check the database once at startup (and again every 2 minutes while it fails) so a wrong token
// never shows players a sign-in that errors: accounts stay hidden until the database answers.
let healthy = kind === 'files';
async function check() {
  if (kind !== 'upstash') return;
  try { await redis(['PING']); if (!healthy) console.log('accounts: database connected, email sign-up is on'); healthy = true; }
  catch (e) {
    healthy = false;
    const t = UP_TOKEN, shape = `${t.length} characters${/\*/.test(t) ? ', contains * (a hidden placeholder was copied, not the token)' : ''}${/^A/.test(t) ? '' : ', does not start with "A" like Upstash tokens do'}`;
    console.log(`accounts: hidden - Upstash refused the connection (${e.message.split('.')[0]}). Token set in Render: ${shape}.`);
    setTimeout(check, 120000);
  }
}
check();
export const storage = { getRecord, putRecord, get enabled() { return kind !== 'none' && healthy; }, kind };
export { getRecord, putRecord };
/** Raw Upstash command (leaderboard). */
export const redisCmd = (cmd) => redis(cmd);
