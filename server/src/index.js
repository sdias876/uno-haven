import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomManager, MAX_SEATS } from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN },
  pingInterval: 10_000,
  pingTimeout: 8_000,
});
const rooms = new RoomManager(io);

app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size, uptime: process.uptime() }));

// In production the server also hosts the built React client (single deploy).
const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get(/^\/(?!socket\.io|healthz).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

/** Wrap handlers: always ack, never crash the process on a bad payload. */
function on(socket, event, handler) {
  socket.on(event, (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const result = handler(payload ?? {}) ?? { ok: true };
      reply(result);
    } catch (err) {
      console.error(`[${event}]`, err);
      reply({ error: 'Server error' });
    }
  });
}

io.on('connection', (socket) => {
  const room = () => rooms.get(socket.data.roomCode);
  const leaveCurrent = () => { const r = room(); if (r) r.leave(socket); socket.data.roomCode = null; };

  on(socket, 'room:create', ({ name, avatar }) => {
    leaveCurrent();
    const r = rooms.create();
    const seat = r.addHuman(socket, { name, avatar });
    r.broadcast();
    return { ok: true, code: r.code, token: seat.token, playerId: seat.id, ...r.snapshotFor(socket) };
  });

  on(socket, 'room:join', ({ code, name, avatar, token }) => {
    const r = rooms.get(code);
    if (!r) return { error: 'Room not found — check the code' };
    if (socket.data.roomCode && socket.data.roomCode !== r.code) leaveCurrent();
    if (token) {
      const seat = r.reclaim(socket, token);
      if (seat) { r.broadcast(); return { ok: true, code: r.code, role: 'player', token: seat.token, playerId: seat.id, ...r.snapshotFor(socket) }; }
    }
    if (r.phase !== 'playing' && r.seats.length < MAX_SEATS) {
      const seat = r.addHuman(socket, { name, avatar });
      r.broadcast();
      return { ok: true, code: r.code, role: 'player', token: seat.token, playerId: seat.id, ...r.snapshotFor(socket) };
    }
    r.addSpectator(socket, { name, avatar });
    r.broadcast();
    return { ok: true, code: r.code, role: 'spectator', ...r.snapshotFor(socket) };
  });

  on(socket, 'room:leave', () => { leaveCurrent(); return { ok: true }; });

  const hostOnly = (fn) => (payload) => {
    const r = room();
    if (!r) return { error: 'Not in a room' };
    if (!r.isHost(socket)) return { error: 'Only the host can do that' };
    const res = fn(r, payload);
    r.broadcast();
    return res;
  };
  const member = (fn) => (payload) => {
    const r = room();
    if (!r) return { error: 'Not in a room' };
    return fn(r, payload);
  };

  on(socket, 'lobby:addBot', hostOnly((r, { level }) => r.addBot(level)));
  on(socket, 'lobby:removeSeat', hostOnly((r, { playerId }) => r.removeSeat(playerId)));
  on(socket, 'lobby:botLevel', hostOnly((r, { playerId, level }) => r.setBotLevel(playerId, level)));
  on(socket, 'lobby:rules', hostOnly((r, { rules, settings }) => r.setRules(rules, settings)));
  on(socket, 'lobby:start', hostOnly((r) => r.start()));
  on(socket, 'lobby:backToLobby', member((r) => { const res = r.backToLobby(socket); r.broadcast(); return res; }));
  on(socket, 'lobby:takeSeat', member((r) => { const res = r.takeSeat(socket); r.broadcast(); return res.error ? res : { ok: true, token: res.seat.token, playerId: res.seat.id }; }));

  on(socket, 'game:play', member((r, p) => r.act(socket, 'play', p)));
  on(socket, 'game:draw', member((r) => r.act(socket, 'draw')));
  on(socket, 'game:pass', member((r) => r.act(socket, 'pass')));
  on(socket, 'game:uno', member((r) => r.act(socket, 'uno')));
  on(socket, 'game:catch', member((r, p) => r.act(socket, 'catch', p)));
  on(socket, 'game:hint', member((r) => r.hint(socket)));
  on(socket, 'game:rematch', member((r) => { const res = r.rematch(socket); r.broadcast(); return res; }));

  on(socket, 'social:chat', member((r, { text }) => r.chatMessage(socket, text)));
  on(socket, 'social:emote', member((r, { emoji }) => r.emote(socket, emoji)));

  socket.on('disconnect', () => room()?.onDisconnect(socket));
});

server.listen(PORT, () => console.log(`🃏 UNO Haven server listening on http://localhost:${PORT}`));

export { app, server, io, rooms };
