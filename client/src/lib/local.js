// Offline mode: runs the REAL server code (rooms, rules engine, smart bots, coach)
// inside the browser, wired to the UI through a tiny in-memory stand-in for Socket.io.
// Solo games start instantly, never lag, and keep working with no internet.
import { RoomManager } from '@game/rooms.js';
import { attachHandlers } from '@game/handlers.js';

const LOCAL_ID = 'local-player';

class LocalSocket {
  constructor(io, deliver) {
    this.id = LOCAL_ID;
    this.io = io;
    this.data = {};
    this.handlers = new Map();
    this.deliver = deliver; // server → client
  }
  // server side API (used by rooms.js / handlers.js)
  on(event, fn) { this.handlers.set(event, fn); }
  join(code) {
    const rooms = this.io.sockets.adapter.rooms;
    if (!rooms.has(code)) rooms.set(code, new Set());
    rooms.get(code).add(this.id);
  }
  leave(code) { this.io.sockets.adapter.rooms.get(code)?.delete(this.id); }
  emit(event, data) { queueMicrotask(() => this.deliver(event, data)); }
  // client side API
  request(event, payload) {
    return new Promise((resolve) => {
      const h = this.handlers.get(event);
      if (!h) return resolve({ error: 'Not available offline' });
      h(payload ?? {}, resolve);
    });
  }
}

class LocalIO {
  constructor() {
    this.sockets = { sockets: new Map(), adapter: { rooms: new Map() } };
    this.connectionHandler = null;
  }
  on(event, fn) { if (event === 'connection') this.connectionHandler = fn; }
  to(code) {
    return {
      emit: (event, data) => {
        for (const sid of this.sockets.adapter.rooms.get(code) ?? []) this.sockets.sockets.get(sid)?.emit(event, data);
      },
    };
  }
  connect(deliver) {
    const s = new LocalSocket(this, deliver);
    this.sockets.sockets.set(s.id, s);
    this.connectionHandler?.(s);
    return s;
  }
}

/** Create an in-browser game server. `deliver(event, data)` receives server → client events. */
export function createLocalServer(deliver) {
  const io = new LocalIO();
  const rooms = new RoomManager(io);
  attachHandlers(io, rooms);
  const socket = io.connect(deliver);
  return {
    request: (event, payload) => socket.request(event, payload),
    dispose: () => { for (const code of [...rooms.rooms.keys()]) rooms.delete(code); },
  };
}
