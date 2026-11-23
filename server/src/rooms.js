// Room manager: lobby, seats, bots, timers, AFK takeover, reconnection, spectators, chat.

import { randomBytes, randomInt } from 'node:crypto';
import { UnoGame, DEFAULT_RULES } from './game/engine.js';
import { chooseBotMove, coachHint, botName, botRemembersUno, botCatchDelay, BOT_LEVELS } from './game/ai.js';

export const MAX_SEATS = 6;
const RECLAIM_MS = 60_000;
const EMPTY_ROOM_TTL_MS = 5 * 60_000;
const EMOTES = ['👍', '😂', '😱', '🔥', '😈', '🙏', '👏', '😭', '🎉', '💀'];
const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🦉', '🐙', '🦄', '🐨', '🐵', '🐧', '🦁', '🐳'];

const id = (prefix) => `${prefix}_${randomBytes(6).toString('hex')}`;
const token = () => randomBytes(18).toString('base64url');
const clean = (s, max = 20) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, max);

function roomCode(existing) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 5 }, () => A[randomInt(A.length)]).join(''); } while (existing.has(code));
  return code;
}

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }
  create() {
    const code = roomCode(this.rooms);
    const room = new Room(code, this);
    this.rooms.set(code, room);
    return room;
  }
  get(code) { return this.rooms.get(String(code ?? '').toUpperCase()); }
  delete(code) {
    const r = this.rooms.get(code);
    if (r) r.dispose();
    this.rooms.delete(code);
  }
}

class Room {
  constructor(code, manager) {
    this.code = code;
    this.manager = manager;
    this.io = manager.io;
    this.seats = [];            // ordered seats (players)
    this.spectators = new Map(); // socketId -> { name, avatar }
    this.hostId = null;
    this.rules = { ...DEFAULT_RULES };
    this.settings = { turnSeconds: 15, spectatorsSeeHands: true };
    this.phase = 'lobby';       // lobby | playing | ended
    this.game = null;
    this.recap = null;
    this.chat = [];
    this.rematchVotes = new Set();
    this.timers = { turn: null, bot: null, catch: [], reclaim: new Map(), ttl: null };
    this.turnEndsAt = null;
    this.lastChat = new Map();
    this.matchNumber = 0;
  }

  // ---------- membership ----------
  seatBySocket(socketId) { return this.seats.find((s) => s.socketId === socketId); }
  seatById(pid) { return this.seats.find((s) => s.id === pid); }
  humans() { return this.seats.filter((s) => !s.isBot); }

  addHuman(socket, { name, avatar }) {
    const seat = {
      id: id('p'), token: token(), name: clean(name) || 'Player', avatar: AVATARS.includes(avatar) ? avatar : AVATARS[this.seats.length % AVATARS.length],
      isBot: false, botLevel: null, socketId: socket.id, connected: true, autopilot: false, afkStrikes: 0,
    };
    this.seats.push(seat);
    if (!this.hostId) this.hostId = seat.id;
    this.attach(socket);
    this.system(`${seat.name} joined`);
    return seat;
  }

  reclaim(socket, tok) {
    const seat = this.seats.find((s) => s.token && s.token === tok);
    if (!seat) return null;
    // Kick any stale socket for the same seat
    if (seat.socketId && seat.socketId !== socket.id) this.io.sockets.sockets.get(seat.socketId)?.leave(this.code);
    seat.socketId = socket.id;
    seat.connected = true;
    seat.autopilot = false;
    seat.afkStrikes = 0;
    clearTimeout(this.timers.reclaim.get(seat.id));
    this.timers.reclaim.delete(seat.id);
    this.attach(socket);
    this.system(`${seat.name} is back`);
    this.fx([{ type: 'reconnected', playerId: seat.id }]);
    // If it's their turn, restart a fresh human timer
    if (this.phase === 'playing' && this.game.current.id === seat.id) this.scheduleTurn();
    return seat;
  }

  addSpectator(socket, { name, avatar }) {
    this.spectators.set(socket.id, { name: clean(name) || 'Spectator', avatar: AVATARS.includes(avatar) ? avatar : '👀' });
    this.attach(socket);
    this.system(`${clean(name) || 'A spectator'} is watching`);
  }

  attach(socket) {
    socket.join(this.code);
    socket.data.roomCode = this.code;
    clearTimeout(this.timers.ttl);
    this.timers.ttl = null;
  }

  takeSeat(socket) {
    const spec = this.spectators.get(socket.id);
    if (!spec) return { error: 'You are not spectating' };
    if (this.phase === 'playing') return { error: 'Wait for the next round' };
    if (this.seats.length >= MAX_SEATS) return { error: 'Table is full' };
    this.spectators.delete(socket.id);
    const seat = this.addHuman(socket, spec);
    return { seat };
  }

  onDisconnect(socket) {
    if (this.spectators.delete(socket.id)) { this.broadcast(); this.checkEmpty(); return; }
    const seat = this.seatBySocket(socket.id);
    if (!seat) return;
    seat.connected = false;
    seat.socketId = null;
    this.system(`${seat.name} disconnected — 60s to reconnect`);
    if (this.phase === 'playing') {
      seat.autopilot = true;
      this.fx([{ type: 'takeover', playerId: seat.id, reason: 'disconnect' }]);
      if (this.game.current.id === seat.id) this.scheduleTurn();
    }
    this.timers.reclaim.set(seat.id, setTimeout(() => this.abandonSeat(seat.id), RECLAIM_MS));
    this.passHostIfNeeded();
    this.broadcast();
    this.checkEmpty();
  }

  leave(socket) {
    if (this.spectators.delete(socket.id)) { socket.leave(this.code); this.broadcast(); this.checkEmpty(); return; }
    const seat = this.seatBySocket(socket.id);
    if (!seat) return;
    socket.leave(this.code);
    seat.socketId = null;
    seat.connected = false;
    this.abandonSeat(seat.id, true);
  }

  /** Seat not reclaimed: in lobby it's removed; mid-game a bot keeps it permanently. */
  abandonSeat(pid, voluntary = false) {
    this.timers.reclaim.delete(pid);
    const seat = this.seatById(pid);
    if (!seat || seat.connected) return;
    if (this.phase === 'playing') {
      seat.isBot = true;
      seat.botLevel = 'tactical';
      seat.token = null;
      seat.name = `${seat.name.replace(/ 🤖$/, '')} 🤖`;
      const gp = this.game.player(pid);
      if (gp) gp.name = seat.name;
      this.system(`${seat.name.replace(/ 🤖$/, '')} ${voluntary ? 'left' : "didn't return"} — a bot holds the seat`);
      if (this.game.current.id === pid) this.scheduleTurn();
    } else {
      this.seats = this.seats.filter((s) => s.id !== pid);
      this.system(`${seat.name} left`);
    }
    this.passHostIfNeeded();
    this.broadcast();
    this.checkEmpty();
  }

  passHostIfNeeded() {
    const host = this.seatById(this.hostId);
    if (host && host.connected && !host.isBot) return;
    const next = this.seats.find((s) => !s.isBot && s.connected);
    if (next && next.id !== this.hostId) {
      this.hostId = next.id;
      this.system(`${next.name} is now the host`);
    }
  }

  checkEmpty() {
    const anyone = this.seats.some((s) => !s.isBot && s.connected) || this.spectators.size > 0;
    if (anyone) return;
    clearTimeout(this.timers.ttl);
    this.timers.ttl = setTimeout(() => this.manager.delete(this.code), EMPTY_ROOM_TTL_MS);
  }

  // ---------- lobby ----------
  isHost(socket) { return this.seatBySocket(socket.id)?.id === this.hostId; }

  addBot(level) {
    if (this.phase === 'playing') return { error: 'Game in progress' };
    if (this.seats.length >= MAX_SEATS) return { error: 'Table is full' };
    const lvl = BOT_LEVELS.includes(level) ? level : 'tactical';
    const seat = {
      id: id('bot'), token: null, name: botName(lvl, this.seats.map((s) => s.name)), avatar: '🤖',
      isBot: true, botLevel: lvl, socketId: null, connected: true, autopilot: false, afkStrikes: 0,
    };
    this.seats.push(seat);
    return { seat };
  }

  removeSeat(pid) {
    if (this.phase === 'playing') return { error: 'Game in progress' };
    const seat = this.seatById(pid);
    if (!seat) return { error: 'No such seat' };
    if (!seat.isBot) {
      if (pid === this.hostId) return { error: "Host can't remove themselves" };
      const sock = seat.socketId && this.io.sockets.sockets.get(seat.socketId);
      if (sock) { this.spectators.set(sock.id, { name: seat.name, avatar: seat.avatar }); }
    }
    this.seats = this.seats.filter((s) => s.id !== pid);
    return { ok: true };
  }

  setBotLevel(pid, level) {
    const seat = this.seatById(pid);
    if (!seat?.isBot || !BOT_LEVELS.includes(level)) return { error: 'Invalid' };
    seat.botLevel = level;
    seat.name = botName(level, this.seats.filter((s) => s !== seat).map((s) => s.name));
    return { ok: true };
  }

  setRules(rules = {}, settings = {}) {
    if (this.phase === 'playing') return { error: 'Game in progress' };
    for (const k of Object.keys(DEFAULT_RULES)) if (typeof rules[k] === 'boolean') this.rules[k] = rules[k];
    if ([0, 15, 30, 60].includes(settings.turnSeconds)) this.settings.turnSeconds = settings.turnSeconds;
    if (typeof settings.spectatorsSeeHands === 'boolean') this.settings.spectatorsSeeHands = settings.spectatorsSeeHands;
    return { ok: true };
  }

  start() {
    if (this.phase === 'playing') return { error: 'Already playing' };
    if (this.seats.length < 2) return { error: 'Need at least 2 players — add a bot!' };
    this.clearGameTimers();
    this.game = new UnoGame({ players: this.seats.map((s) => ({ id: s.id, name: s.name })), rules: this.rules });
    this.phase = 'playing';
    this.recap = null;
    this.rematchVotes.clear();
    this.matchNumber++;
    for (const s of this.seats) { s.afkStrikes = 0; if (!s.isBot) s.autopilot = !s.connected; }
    this.fx([{ type: 'deal', count: 7 }]);
    this.system(`Match ${this.matchNumber} started`);
    this.scheduleTurn();
    return { ok: true };
  }

  rematch(socket) {
    if (this.phase !== 'ended') return { error: 'Match not finished' };
    const seat = this.seatBySocket(socket.id);
    if (!seat) return { error: 'Spectators can’t start a rematch' };
    this.rematchVotes.add(seat.id);
    const humans = this.humans().filter((s) => s.connected);
    if (seat.id === this.hostId || humans.every((h) => this.rematchVotes.has(h.id))) return this.start();
    this.system(`${seat.name} wants a rematch`);
    return { ok: true };
  }

  backToLobby(socket) {
    if (!this.isHost(socket)) return { error: 'Only the host can do that' };
    if (this.phase === 'playing') return { error: 'Game in progress' };
    this.phase = 'lobby';
    this.game = null;
    this.recap = null;
    return { ok: true };
  }

  // ---------- game actions ----------
  act(socket, kind, payload = {}) {
    if (this.phase !== 'playing') return { error: 'No game running' };
    const seat = this.seatBySocket(socket.id);
    if (!seat) return { error: 'Spectators can’t play' };
    seat.autopilot = false;
    seat.afkStrikes = 0;
    return this.apply(seat.id, kind, payload);
  }

  apply(pid, kind, payload = {}) {
    const g = this.game;
    let r;
    switch (kind) {
      case 'play': r = g.play(pid, String(payload.cardId), { color: payload.color, swapTargetId: payload.swapTargetId }); break;
      case 'draw': r = g.draw(pid); break;
      case 'pass': r = g.pass(pid); break;
      case 'uno': r = g.callUno(pid); break;
      case 'catch': r = g.catchUno(pid, String(payload.targetId)); break;
      default: return { error: 'Unknown action' };
    }
    if (!r.ok) return { error: r.error };
    this.afterAction(r.events, kind);
    return { ok: true };
  }

  hint(socket) {
    if (this.phase !== 'playing') return { error: 'No game running' };
    const seat = this.seatBySocket(socket.id);
    if (!seat) return { error: 'Spectators don’t get hints' };
    return { hint: coachHint(this.game, seat.id) };
  }

  afterAction(events, kind) {
    if (events.length) this.fx(events);
    if (this.game.phase === 'ended') {
      this.clearGameTimers();
      this.phase = 'ended';
      this.recap = this.game.recap();
      const w = this.seatById(this.game.winnerId);
      this.system(`🏆 ${w?.name ?? 'Someone'} wins with ${this.recap.score} points!`);
      this.broadcast();
      return;
    }
    this.scheduleCatches();
    // uno / catch don't change whose turn it is — keep the running timer
    if (kind !== 'uno' && kind !== 'catch') this.scheduleTurn();
    this.broadcast();
  }

  /** Bots pounce on anyone who forgot to call UNO. */
  scheduleCatches() {
    this.timers.catch.forEach(clearTimeout);
    this.timers.catch = [];
    const target = this.game.unoVulnerable;
    if (!target) return;
    const tSeat = this.seatById(target);
    // Autopilot always covers for an absent human
    if (tSeat?.autopilot) {
      this.timers.catch.push(setTimeout(() => this.safely(() => this.game.unoVulnerable === target && this.apply(target, 'uno')), 250));
      return;
    }
    for (const s of this.seats) {
      if (!s.isBot || s.id === target) continue;
      const delay = botCatchDelay(s.botLevel);
      if (delay == null) continue;
      this.timers.catch.push(setTimeout(() => this.safely(() => {
        if (this.phase === 'playing' && this.game.unoVulnerable === target) this.apply(s.id, 'catch', { targetId: target });
      }), delay));
    }
  }

  scheduleTurn() {
    clearTimeout(this.timers.turn);
    clearTimeout(this.timers.bot);
    this.turnEndsAt = null;
    if (this.phase !== 'playing') return;
    const cur = this.seatById(this.game.current.id);
    if (!cur) return;
    if (cur.isBot || cur.autopilot) {
      const base = cur.isBot ? { casual: 1300, tactical: 1000, ruthless: 800 }[cur.botLevel] : 900;
      this.timers.bot = setTimeout(() => this.safely(() => this.botTurn(cur.id)), base + Math.random() * 500);
      return;
    }
    const secs = this.settings.turnSeconds;
    if (!secs) return;
    this.turnEndsAt = Date.now() + secs * 1000;
    const turnAt = this.game.turnNumber;
    this.timers.turn = setTimeout(() => this.safely(() => {
      if (this.phase !== 'playing' || this.game.turnNumber !== turnAt || this.game.current.id !== cur.id) return;
      cur.afkStrikes++;
      this.fx([{ type: 'takeover', playerId: cur.id, reason: 'timeout' }]);
      if (cur.afkStrikes >= 3) { cur.autopilot = true; this.system(`${cur.name} seems AFK — autopilot on until they act`); }
      this.botTurn(cur.id, 'tactical');
    }), secs * 1000);
  }

  /** Perform one full turn for a bot (or a human on autopilot/timeout). */
  botTurn(pid, levelOverride) {
    if (this.phase !== 'playing' || this.game.current.id !== pid) return;
    const seat = this.seatById(pid);
    const level = levelOverride ?? seat?.botLevel ?? 'tactical';
    const g = this.game;
    const move = chooseBotMove(g, pid, level);
    if (move.type === 'play') {
      if (g.player(pid).hand.length === 2 && (seat.isBot ? botRemembersUno(level) : true)) {
        const u = g.callUno(pid);
        if (u.events.length) this.fx(u.events);
      }
      const r = g.play(pid, move.cardId, move);
      if (r.ok) return this.afterAction(r.events, 'play');
    }
    if (move.type === 'pass') {
      const r = g.pass(pid);
      if (r.ok) return this.afterAction(r.events, 'pass');
    }
    const r = g.draw(pid);
    if (!r.ok) { // should never happen; fall back to passing
      const p = g.pass(pid);
      return this.afterAction(p.events, 'pass');
    }
    // After a draw, the same player may get to play the drawn card
    if (g.phase === 'playing' && g.current.id === pid && g.drawnCardId) {
      this.fx(r.events);
      this.broadcast();
      clearTimeout(this.timers.bot);
      this.timers.bot = setTimeout(() => this.safely(() => this.botTurn(pid, levelOverride)), 650);
      return;
    }
    this.afterAction(r.events, 'draw');
  }

  safely(fn) {
    try { fn(); } catch (err) { console.error(`[room ${this.code}]`, err); }
  }

  clearGameTimers() {
    clearTimeout(this.timers.turn);
    clearTimeout(this.timers.bot);
    this.timers.catch.forEach(clearTimeout);
    this.timers.catch = [];
    this.turnEndsAt = null;
  }

  dispose() {
    this.clearGameTimers();
    clearTimeout(this.timers.ttl);
    for (const t of this.timers.reclaim.values()) clearTimeout(t);
  }

  // ---------- social ----------
  chatMessage(socket, text) {
    const now = Date.now();
    if (now - (this.lastChat.get(socket.id) ?? 0) < 500) return { error: 'Slow down!' };
    this.lastChat.set(socket.id, now);
    const who = this.seatBySocket(socket.id) ?? this.spectators.get(socket.id);
    if (!who) return { error: 'Not in room' };
    const msg = { id: id('m'), from: who.name, avatar: who.avatar, text: clean(text, 200), spectator: !this.seatBySocket(socket.id), t: now };
    if (!msg.text) return { error: 'Empty message' };
    this.pushChat(msg);
    return { ok: true };
  }

  emote(socket, emoji) {
    if (!EMOTES.includes(emoji)) return { error: 'Unknown emote' };
    const now = Date.now();
    if (now - (this.lastChat.get(`e${socket.id}`) ?? 0) < 400) return { error: 'Slow down!' };
    this.lastChat.set(`e${socket.id}`, now);
    const seat = this.seatBySocket(socket.id);
    const spec = this.spectators.get(socket.id);
    this.io.to(this.code).emit('social:emote', { fromId: seat?.id ?? null, from: seat?.name ?? spec?.name, emoji, id: id('e') });
    return { ok: true };
  }

  system(text) { this.pushChat({ id: id('m'), system: true, text, t: Date.now() }); }
  pushChat(msg) {
    this.chat.push(msg);
    if (this.chat.length > 80) this.chat.shift();
    this.io.to(this.code).emit('social:chat', msg);
  }

  // ---------- broadcasting ----------
  fx(events) { this.io.to(this.code).emit('game:fx', events); }

  publicRoom() {
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      rules: this.rules,
      settings: this.settings,
      maxSeats: MAX_SEATS,
      matchNumber: this.matchNumber,
      turnMsLeft: this.turnEndsAt ? Math.max(0, this.turnEndsAt - Date.now()) : null,
      seats: this.seats.map((s) => ({
        id: s.id, name: s.name, avatar: s.avatar, isBot: s.isBot, botLevel: s.botLevel,
        connected: s.isBot || s.connected, autopilot: s.autopilot,
      })),
      spectators: [...this.spectators.values()].map((s) => ({ name: s.name, avatar: s.avatar })),
      rematchVotes: [...this.rematchVotes],
      recap: this.recap,
    };
  }

  broadcast() {
    const room = this.publicRoom();
    const sockets = this.io.sockets.adapter.rooms.get(this.code);
    if (!sockets) return;
    for (const sid of sockets) {
      const sock = this.io.sockets.sockets.get(sid);
      if (!sock) continue;
      const seat = this.seatBySocket(sid);
      const spectating = !seat;
      const game = this.game
        ? this.game.view(seat?.id ?? '__spectator__', { revealAll: spectating && this.settings.spectatorsSeeHands })
        : null;
      sock.emit('room:state', { room, game, me: seat ? { id: seat.id, role: 'player', isHost: seat.id === this.hostId } : { id: null, role: 'spectator', isHost: false } });
    }
  }

  snapshotFor(socket) {
    return { chat: this.chat.slice(-40) };
  }
}
