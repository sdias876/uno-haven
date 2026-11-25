// Socket event routing. Shared by the real server (index.js) and the
// in-browser offline mode (client/src/lib/local.js), so both behave identically.

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

export function attachHandlers(io, rooms) {
io.on('connection', (socket) => {
  const room = () => rooms.get(socket.data.roomCode);
  const leaveCurrent = () => { const r = room(); if (r) r.leave(socket); socket.data.roomCode = null; };

  on(socket, 'room:create', ({ name, avatar, skill }) => {
    leaveCurrent();
    const r = rooms.create({ skill });
    const seat = r.addHuman(socket, { name, avatar });
    r.broadcast();
    return { ok: true, code: r.code, token: seat.token, playerId: seat.id, ...r.snapshotFor(socket) };
  });

  // Online lobby: sit at a public table (matched by size and bet) or list the live ones.
  on(socket, 'room:quick', ({ name, avatar, size, bet }) => {
    leaveCurrent();
    const r = rooms.quick({ size: Number(size), bet: Number(bet) });
    const seat = r.addHuman(socket, { name, avatar });
    r.checkFull();
    r.broadcast();
    return { ok: true, code: r.code, role: 'player', token: seat.token, playerId: seat.id, ...r.snapshotFor(socket) };
  });
  on(socket, 'rooms:list', () => ({ ok: true, tables: rooms.list(), online: io.engine?.clientsCount ?? 1 }));

  on(socket, 'room:join', ({ code, name, avatar, token, watch }) => {
    const r = rooms.get(code);
    if (!r) return { error: 'Room not found — check the code' };
    if (socket.data.roomCode && socket.data.roomCode !== r.code) leaveCurrent();
    if (token) {
      const seat = r.reclaim(socket, token);
      if (seat) { r.broadcast(); return { ok: true, code: r.code, role: 'player', token: seat.token, playerId: seat.id, ...r.snapshotFor(socket) }; }
    }
    if (r.phase !== 'playing' && r.seats.length < r.size && !watch) {
      const seat = r.addHuman(socket, { name, avatar });
      r.checkFull();
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

  on(socket, 'lobby:fillNow', member((r) => {
    if (!r.isPublic || !r.seatBySocket(socket.id)) return { error: 'Not allowed' };
    r.fillAndStart();
    return { ok: true };
  }));
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
}
