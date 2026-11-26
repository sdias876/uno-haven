// Coins, level, stats, spins and gifts — saved on this device, like Sequence Haven.
const KEY = 'unohaven.wallet';
export const START_COINS = 50000, FREE_COINS = 250, FREE_EVERY = 3600e3, SPIN_EVERY = 4 * 3600e3;
export const DAILY = [1000, 1500, 2000, 2500, 3000, 4000, 5000];
export const BETS = [100, 500, 1000, 2500, 5000, 10000];
export const fmt = (n) => Math.round(n).toLocaleString('en-US');

function load() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY)); } catch { /* ignore */ }
  if (!p || typeof p.coins !== 'number' || !isFinite(p.coins)) {
    p = { coins: START_COINS, xp: 0, played: 0, won: 0, bestWin: 0, bestSpin: 0, spins: 0, lastSpin: 0, lastFree: 0, lastDaily: '', streak: 0, games: {} };
  }
  p.games = p.games || {};
  // lasting player id for the leaderboard (saved with the account, so it follows you to other devices)
  if (!/^[a-zA-Z0-9_-]{8,48}$/.test(p.pid || '')) p.pid = 'ek' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return p;
}
export const P = load();
const subs = new Set();
export const onWallet = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export function saveP() {
  const k = Object.keys(P.games);
  if (k.length > 40) k.slice(0, k.length - 40).forEach((x) => delete P.games[x]);
  P.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* private mode */ }
  subs.forEach((f) => f(P));
}
/** Take progress saved to the player's account onto this device (keeps its timestamp). */
export function adoptP(pr, at) {
  const keep = P.games;
  const pid = P.pid;
  Object.assign(P, pr); delete P.avatar; P.games = keep; P.updatedAt = at || Date.now();
  if (!P.pid) P.pid = pid;
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* ignore */ }
  subs.forEach((f) => f(P, true));
}
export const lvBase = (L) => 60 * L * (L - 1);
export const levelOf = (xp) => { let L = 1; while (xp >= lvBase(L + 1)) L++; return L; };
export function addXp(n, toast) {
  const before = levelOf(P.xp); P.xp += n; const after = levelOf(P.xp);
  if (after > before) setTimeout(() => { P.coins += after * 500; saveP(); toast?.(`★ Level up! You're now level ${after}. +${fmt(after * 500)} coins`, 'good'); }, 1600);
}

const gameKey = (room) => `${room.code}:${room.matchNumber}`;

/** Bets: taken when a match starts, paid out when it ends. The winner takes the pot (bet × players). */
export function settleBets(room, me, toast) {
  if (!room || !me?.id || me.role !== 'player' || room.phase === 'lobby') return;
  const key = gameKey(room), bet = Number(room.settings?.bet) || 0, players = room.seats.length;
  let rec = P.games[key];
  if (!rec) {
    rec = P.games[key] = { bet: 0, done: room.phase === 'ended', players };
    if (!rec.done && bet > 0) {
      if (P.coins >= bet) { P.coins -= bet; rec.bet = bet; toast?.(`Bet placed: ${fmt(bet)} coins. Win ${fmt(bet * players)}!`, 'info'); }
      else toast?.(`Not enough coins for the ${fmt(bet)} bet, so you're playing this game for free.`, 'bad');
    }
    saveP();
  }
  if (room.phase === 'ended' && !rec.done && room.recap) {
    rec.done = true;
    const win = room.recap.winnerId === me.id;
    const back = win ? rec.bet * rec.players : 0;
    P.coins += back; rec.net = back - rec.bet; rec.win = win;
    P.played++; if (win) { P.won++; P.bestWin = Math.max(P.bestWin, rec.net); }
    addXp(win ? 40 : 15, toast);
    saveP();
  }
}
export const resultFor = (room) => (room ? P.games[gameKey(room)] : null);
