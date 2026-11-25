// Email accounts for Ek Haven (modelled on Spade Haven's): an id + secret key held by the player's device,
// a scrypt password hash, and the player's saved progress (coins, level, stats, picture, name).
import crypto from 'node:crypto';
import { storage, getRecord, putRecord } from './storage.js';
import { sendMail, mailConfigured } from './mail.js';

class AuthError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, (e, k) => e ? rej(e) : res(k)));
async function hash(pw) { const salt = crypto.randomBytes(16).toString('hex'); return `${salt}:${(await scrypt(pw, salt)).toString('hex')}`; }
async function verify(pw, stored) {
  const [salt, h] = String(stored || '').split(':'); if (!salt || !h) return false;
  const got = await scrypt(pw, salt), want = Buffer.from(h, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
const normEmail = e => String(e == null ? '' : e).trim().toLowerCase();
const emailOk = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 40);
const emailRef = e => `email-${sha(e)}`;
const acctKey = id => `acct-${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}`;
const resetKey = t => `reset-${sha(t)}`;
const cleanName = s => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16);
const SITE = () => String(process.env.PUBLIC_URL || 'https://ek.sedigitaltransformation.com').replace(/\/+$/, '');
const pub = a => ({id: a.id, key: a.key, email: a.email, name: a.name, profile: a.profile || null, updatedAt: a.updatedAt || 0});
// the parts of a profile the server keeps (anything else is dropped)
function cleanProfile(p) {
  if (!p || typeof p !== 'object') return null;
  const n = v => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(1e12, Math.floor(Number(v)))) : 0);
  return {coins: n(p.coins), xp: n(p.xp), played: n(p.played), won: n(p.won), bestWin: n(p.bestWin), bestSpin: n(p.bestSpin), spins: n(p.spins),
    lastSpin: n(p.lastSpin), lastFree: n(p.lastFree), lastDaily: String(p.lastDaily || '').slice(0, 40), streak: n(p.streak) % 1000,
    avatar: /^(a|p)\d{1,2}$/.test(p.avatar) ? p.avatar : null};
}

function welcomeMail(email, name) {
  if (!mailConfigured()) return;
  const site = SITE(), safe = name.replace(/[<>&]/g, '');
  const text = `Welcome to Ek Haven, ${name}!\n\nYour account is ready. Match the color or the number and call EK! with one card left, against smart bots or friends online. Spin the Mega Bonus wheel and collect your daily gifts.\n\nPlay now: ${site}\n\nNeed help? Reply to this email.\n\n★ Ek Haven`;
  const html = `<p>Welcome to Ek Haven, ${safe}!</p><p>Your account is ready. Match the color or the number and call EK! with one card left, against smart bots or friends online. Spin the Mega Bonus wheel and collect your daily gifts.</p><p><a href="${site}" style="display:inline-block;padding:12px 22px;background:#1a9d4a;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Play now</a></p><p style="color:#666;font-size:13px">Need help? Reply to this email.</p><p>★ Ek Haven</p>`;
  sendMail(email, 'Welcome to Ek Haven ★', text, html).catch(() => {});
}

async function signUp(b) {
  if (!storage.enabled) throw new AuthError('Accounts are not switched on yet.', 503);
  const email = normEmail(b.email), pw = String(b.password == null ? '' : b.password), name = cleanName(b.name);
  if (!emailOk(email)) throw new AuthError('Enter a valid email address.');
  if (pw.length < 6) throw new AuthError('Use a password of at least 6 characters.');
  if (pw.length > 200) throw new AuthError('That password is too long.');
  if (name.length < 2) throw new AuthError('Choose a name of at least 2 letters.');
  if (await getRecord(emailRef(email))) throw new AuthError('An account with this email already exists. Sign in instead.', 409);
  const a = {id: `e${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`, key: crypto.randomBytes(18).toString('base64url'),
    email, name, pass: await hash(pw), profile: cleanProfile(b.profile), createdAt: Date.now(), updatedAt: Date.now()};
  await putRecord(acctKey(a.id), a);
  await putRecord(emailRef(email), {id: a.id});
  welcomeMail(email, name);
  return pub(a);
}
async function signIn(b) {
  if (!storage.enabled) throw new AuthError('Accounts are not switched on yet.', 503);
  const email = normEmail(b.email), pw = String(b.password == null ? '' : b.password);
  const ref = emailOk(email) ? await getRecord(emailRef(email)) : null;
  const a = ref ? await getRecord(acctKey(ref.id)) : null;
  if (!a || !(await verify(pw, a.pass))) throw new AuthError('Wrong email or password.', 401);
  return pub(a);
}
async function own(b) {
  const a = await getRecord(acctKey(String(b.id || '')));
  if (!a || !b.key || a.key !== String(b.key)) throw new AuthError('Please sign in again.', 403);
  return a;
}
async function load(b) { return pub(await own(b)); }
async function save(b) {
  const a = await own(b);
  const at = Number(b.updatedAt) || 0;
  if (at < (a.updatedAt || 0)) return {ok: false, newer: pub(a)};   // another device saved newer progress
  a.profile = cleanProfile(b.profile); a.updatedAt = at;
  if (b.name !== undefined && cleanName(b.name).length >= 2) a.name = cleanName(b.name);
  await putRecord(acctKey(a.id), a);
  return {ok: true};
}
async function changePassword(b) {
  const a = await own(b);
  if (!(await verify(String(b.current || ''), a.pass))) throw new AuthError('Your current password is wrong.', 401);
  if (String(b.password || '').length < 6) throw new AuthError('Use a password of at least 6 characters.');
  a.pass = await hash(String(b.password)); await putRecord(acctKey(a.id), a);
  return {ok: true};
}
const lastAsk = new Map();
async function forgot(b) {
  if (!storage.enabled) throw new AuthError('Accounts are not switched on yet.', 503);
  if (!mailConfigured()) throw new AuthError('Password reset by email isn’t set up yet.', 503);
  const email = normEmail(b.email);
  if (!emailOk(email)) throw new AuthError('Enter the email address you signed up with.');
  const now = Date.now();
  if (now - (lastAsk.get(email) || 0) < 60000) return {ok: true};
  lastAsk.set(email, now); if (lastAsk.size > 5000) lastAsk.clear();
  const ref = await getRecord(emailRef(email));
  const a = ref ? await getRecord(acctKey(ref.id)) : null;
  if (a) {
    const token = crypto.randomBytes(24).toString('base64url');
    await putRecord(resetKey(token), {id: a.id, exp: now + 30 * 60000});
    const link = `${SITE()}/?reset=${token}`, safe = a.name.replace(/[<>&]/g, '');
    const text = `Hi ${a.name},\n\nSomeone asked to reset the password for your Ek Haven account. To choose a new password, open this link within 30 minutes:\n\n${link}\n\nIf this wasn’t you, ignore this email. Your password stays the same.\n\n★ Ek Haven`;
    const html = `<p>Hi ${safe},</p><p>Someone asked to reset the password for your Ek Haven account. To choose a new password, use the button below within 30 minutes.</p><p><a href="${link}" style="display:inline-block;padding:12px 22px;background:#1a9d4a;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p><p style="color:#666;font-size:13px">If the button doesn’t work, copy this link: ${link}<br>If this wasn’t you, ignore this email.</p><p>★ Ek Haven</p>`;
    if (!(await sendMail(email, 'Reset your Ek Haven password', text, html))) console.error('forgot-password: email not sent');
  }
  return {ok: true};
}
async function reset(b) {
  const token = String(b.token || '');
  if (!/^[\w-]{20,60}$/.test(token)) throw new AuthError('This reset link isn’t valid. Ask for a new one.');
  if (String(b.password || '').length < 6) throw new AuthError('Use a password of at least 6 characters.');
  const rec = await getRecord(resetKey(token));
  if (!rec || !rec.id || rec.exp < Date.now()) throw new AuthError('This reset link has expired or was already used. Ask for a new one.');
  const a = await getRecord(acctKey(rec.id));
  if (!a) throw new AuthError('This reset link isn’t valid. Ask for a new one.');
  a.pass = await hash(String(b.password)); await putRecord(acctKey(a.id), a);
  await putRecord(resetKey(token), {id: '', exp: 0});
  return pub(a);
}
const config = () => ({accounts: storage.enabled, resetMail: storage.enabled && mailConfigured()});
export { signUp, signIn, load, save, changePassword, forgot, reset, config, AuthError };
