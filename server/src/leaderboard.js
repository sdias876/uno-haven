// Weekly and all-time rankings, like Spade Haven's leaderboard.
// Only games at online tables with coins on the table count (games against the computer on your device don't).
// The winner adds what they took from the table; everyone else loses their stake.
// Stored in the same Upstash database as accounts; without one, kept in memory until the server restarts.
import { redisCmd, storage } from './accounts/storage.js';

const P = 'ek-haven:lb:';
const WEEK = 7 * 864e5;
// Weeks start Monday 00:00 UTC.
export const weekStart = (t = Date.now()) => { const d = new Date(t); const day = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day); };
const wkey = (start) => `w${new Date(start).toISOString().slice(0, 10)}`;
export const REWARDS = [[1, 50000], [2, 25000], [3, 10000], [10, 5000], [50, 2500], [100, 1000]];
export const rewardFor = (rank) => (rank ? (REWARDS.find(([upTo]) => rank <= upTo)?.[1] ?? 0) : 0);
const okPid = (p) => /^[a-zA-Z0-9_-]{8,48}$/.test(String(p || ''));
const db = () => storage.kind === 'upstash' && storage.enabled;

// ---- in-memory fallback ----
const mem = { boards: new Map(), names: new Map(), claims: new Set() };
const board = (k) => { if (!mem.boards.has(k)) mem.boards.set(k, new Map()); return mem.boards.get(k); };

async function add(k, pid, delta) {
  if (db()) { await redisCmd(['ZINCRBY', P + k, delta, pid]); if (k !== 'all') await redisCmd(['EXPIRE', P + k, 60 * 864e2]); return; }
  const b = board(k); b.set(pid, (b.get(pid) || 0) + delta);
}
async function setName(pid, who) {
  const v = JSON.stringify({ name: String(who.name || 'Player').slice(0, 24), avatar: String(who.avatar || 'a1').slice(0, 8) });
  if (db()) return redisCmd(['HSET', P + 'names', pid, v]);
  mem.names.set(pid, v);
}
async function names(pids) {
  if (!pids.length) return [];
  const raw = db() ? await redisCmd(['HMGET', P + 'names', ...pids]) : pids.map((p) => mem.names.get(p) ?? null);
  return raw.map((v) => { try { return JSON.parse(v); } catch { return { name: 'Player', avatar: 'a1' }; } });
}
/** Top players (score > 0) and where `pid` stands. */
async function top(k, pid, n = 50) {
  let rows; let me = null;
  if (db()) {
    const flat = await redisCmd(['ZREVRANGE', P + k, 0, n - 1, 'WITHSCORES']);
    rows = []; for (let i = 0; i < flat.length; i += 2) rows.push([flat[i], Number(flat[i + 1])]);
    if (okPid(pid)) {
      const [r, s] = await Promise.all([redisCmd(['ZREVRANK', P + k, pid]), redisCmd(['ZSCORE', P + k, pid])]);
      if (r !== null && s !== null) me = { rank: Number(r) + 1, score: Number(s) };
    }
  } else {
    const all = [...board(k).entries()].sort((a, b) => b[1] - a[1]);
    rows = all.slice(0, n);
    const i = all.findIndex(([p]) => p === pid);
    if (i >= 0) me = { rank: i + 1, score: all[i][1] };
  }
  rows = rows.filter(([, s]) => s > 0);
  const who = await names(rows.map(([p]) => p));
  if (me && me.score <= 0) me = { rank: null, score: me.score };
  return { top: rows.map(([p, score], i) => ({ rank: i + 1, score, ...who[i], you: p === pid })), me };
}

/** Called when a game at an online table ends. */
export async function recordResult({ bet, players }) {
  if (!bet || players.length < 2) return;
  const k = wkey(weekStart());
  const n = players.length;
  for (const p of players) {
    if (p.isBot || !okPid(p.pid)) continue;
    const delta = p.won ? bet * (n - 1) : -bet;
    try { await Promise.all([add(k, p.pid, delta), add('all', p.pid, delta), setName(p.pid, p)]); }
    catch (e) { console.log('leaderboard: could not save a result', e.message); }
  }
}

export async function view(pid) {
  const start = weekStart();
  const lastK = wkey(start - WEEK);
  const [week, all, last] = await Promise.all([top(wkey(start), pid), top('all', pid), top(lastK, pid, 10)]);
  const reward = rewardFor(last.me?.rank);
  const claimed = reward ? await isClaimed(lastK, pid) : false;
  return { endsAt: start + WEEK, rewards: REWARDS, week, all, last: { ...last, reward, claimed } };
}
async function isClaimed(k, pid) {
  if (db()) return (await redisCmd(['EXISTS', `${P}claim:${k}:${pid}`])) === 1;
  return mem.claims.has(`${k}:${pid}`);
}
/** Pay last week's rank reward once. */
export async function claim(pid) {
  if (!okPid(pid)) return { error: 'Unknown player' };
  const lastK = wkey(weekStart() - WEEK);
  const { me } = await top(lastK, pid, 1);
  const amount = rewardFor(me?.rank);
  if (!amount) return { error: 'No reward for last week' };
  if (db()) {
    const ok = await redisCmd(['SET', `${P}claim:${lastK}:${pid}`, '1', 'NX', 'EX', 30 * 86400]);
    if (ok !== 'OK') return { error: 'Already collected' };
  } else {
    if (mem.claims.has(`${lastK}:${pid}`)) return { error: 'Already collected' };
    mem.claims.add(`${lastK}:${pid}`);
  }
  return { ok: true, amount, rank: me.rank };
}
