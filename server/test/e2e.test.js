import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';

process.env.PORT = '3999';
const { server, io, rooms } = await import('../src/index.js');
after(() => { for (const code of [...rooms.rooms.keys()]) rooms.delete(code); io.close(); server.close(); });

const URL = 'http://localhost:3999';
const client = () => new Promise((res) => {
  const s = connect(URL, { transports: ['websocket'], forceNew: true });
  s.latest = null;
  s.on('room:state', (st) => { s.latest = st; });
  s.on('connect', () => res(s));
});
const emit = (s, ev, p = {}) => new Promise((res) => s.emit(ev, p, res));
// Resolve with the latest state matching pred (already received or upcoming)
const nextState = (s, pred = () => true) => new Promise((res) => {
  if (s.latest && pred(s.latest)) return res(s.latest);
  const h = (st) => { if (pred(st)) { s.off('room:state', h); res(st); } };
  s.on('room:state', h);
});
const fresh = (s) => new Promise((res) => { s.once('room:state', res); setTimeout(() => res(s.latest), 1500); });

test('full match: human vs ruthless bots using the Smart Coach, plus spectator + reconnect', async () => {
  const a = await client();
  const created = await emit(a, 'room:create', { name: 'Savio', avatar: '🦊' });
  assert.ok(created.ok && created.code.length === 5);
  await emit(a, 'lobby:addBot', { level: 'ruthless' });
  await emit(a, 'lobby:addBot', { level: 'casual' });
  const r = await emit(a, 'lobby:rules', { rules: { stacking: true, jumpIn: true }, settings: { turnSeconds: 0 } });
  assert.ok(r.ok, r.error);

  // Spectator joins once the game is running
  assert.ok((await emit(a, 'lobby:start')).ok);
  const spec = await client();
  const sj = await emit(spec, 'room:join', { code: created.code, name: 'Watcher' });
  assert.equal(sj.role, 'spectator');
  const sv = await nextState(spec, (st) => st.game);
  assert.ok(sv.game.players.every((p) => Array.isArray(p.hand)), 'spectator sees hands');

  // Reconnect: drop the human, come back with the token
  let me = a;
  me.disconnect();
  await new Promise((r) => setTimeout(r, 300));
  me = await client();
  const back = await emit(me, 'room:join', { code: created.code, token: created.token });
  assert.equal(back.role, 'player');
  assert.equal(back.playerId, created.playerId);

  // Play to the end, following the coach
  let state = await nextState(me, (st) => st.game);
  const deadline = Date.now() + 60_000;
  while (state.room.phase === 'playing' && Date.now() < deadline) {
    if (state.game.turnPlayerId === created.playerId) {
      const { hint } = await emit(me, 'game:hint');
      let res;
      if (hint.cardId) {
        if (state.game.hand.length === 2) await emit(me, 'game:uno');
        res = await emit(me, 'game:play', { cardId: hint.cardId, color: hint.color ?? 'red', swapTargetId: state.game.players.find((p) => p.id !== created.playerId).id });
      } else if (hint.action === 'pass') res = await emit(me, 'game:pass');
      else res = await emit(me, 'game:draw');
      if (res.error && !/turn/i.test(res.error)) assert.fail(res.error);
    }
    state = state.game.turnPlayerId === created.playerId ? me.latest : await fresh(me);
  }
  assert.equal(state.room.phase, 'ended');
  assert.ok(state.room.recap.winnerName);
  assert.ok(Array.isArray(state.room.recap.players));

  // Rematch with same group
  const rm = await emit(me, 'game:rematch');
  assert.ok(rm.ok, rm.error);
  const again = await nextState(me, (st) => st.room.phase === 'playing' && st.room.matchNumber === 2);
  assert.equal(again.room.matchNumber, 2);
  me.disconnect(); spec.disconnect();
});

test('AFK takeover: timer expiry lets a bot play the human turn', async () => {
  const a = await client();
  const b = await client();
  const c = await emit(a, 'room:create', { name: 'A' });
  await emit(b, 'room:join', { code: c.code, name: 'B' });
  await emit(a, 'lobby:rules', { settings: { turnSeconds: 15 } });
  await emit(a, 'lobby:start');
  const fx = new Promise((res) => a.on('game:fx', (evs) => evs.some((e) => e.type === 'takeover') && res(evs)));
  // Fast-forward: nobody acts. Takeover should fire within the 15s window.
  const evs = await Promise.race([fx, new Promise((r) => setTimeout(() => r(null), 17_000))]);
  assert.ok(evs, 'takeover happened');
  a.disconnect(); b.disconnect();
});

test('smart bots adapt: strength rises after a human win, is reported to clients', async () => {
  const { rooms: mgr } = await import('../src/index.js');
  const a = await client();
  const c = await emit(a, 'room:create', { name: 'Solo', skill: 0.5 });
  await emit(a, 'lobby:addBot', {}); // default level = smart
  const st = await nextState(a, (s) => s.room.seats.length === 2);
  assert.equal(st.room.seats[1].botLevel, 'smart');
  assert.equal(st.room.botStrength, 0.5);
  const room = mgr.get(c.code);
  room.adaptBots(room.seats[0]); // human won
  assert.ok(room.botStrength > 0.5 && room.botTrend === 'up');
  room.adaptBots(room.seats[1]); // bot won
  assert.equal(room.botTrend, 'down');
  a.disconnect();
});
