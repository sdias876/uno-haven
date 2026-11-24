import { io } from 'socket.io-client';

// Two ways to reach a game server, behind one interface:
//  - 'online': the real Socket.io server (multiplayer, invites, spectators)
//  - 'local' : the same server code running in this browser (instant solo play, works offline)
// Same-origin in production; Vite proxies /socket.io in dev.
// Set VITE_SERVER_URL when the client is deployed separately (e.g. Vercel + Render).
const URL = import.meta.env.VITE_SERVER_URL || undefined;

export const socket = io(URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  transports: ['websocket', 'polling'],
});

const listeners = new Map();
let mode = 'online';
let local = null;

function dispatch(source, event, ...args) {
  if (source !== mode) return;
  listeners.get(event)?.forEach((cb) => cb(...args));
}
socket.onAny((event, ...args) => dispatch('online', event, ...args));
socket.on('connect', () => dispatch('online', 'connect'));
socket.on('disconnect', () => dispatch('online', 'disconnect'));

export const net = {
  get mode() { return mode; },
  get connected() { return mode === 'local' ? true : socket.connected; },
  on(event, cb) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(cb);
  },
  off(event, cb) { listeners.get(event)?.delete(cb); },
  /** Switch to the in-browser server (loaded on demand). */
  async useLocal() {
    if (!local) {
      const { createLocalServer } = await import('./local.js');
      local = createLocalServer((event, data) => dispatch('local', event, data));
    }
    mode = 'local';
  },
  useOnline() {
    if (local) { local.dispose(); local = null; }
    mode = 'online';
  },
};

/** Emit with an ack, as a promise. Resolves { error } on timeout instead of hanging. */
export function send(event, payload = {}, timeoutMs = 6000) {
  if (mode === 'local') return local.request(event, payload);
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({ error: navigator.onLine === false ? 'You’re offline — solo play still works!' : 'Connecting to the server…' });
      return;
    }
    socket.timeout(timeoutMs).emit(event, payload, (err, res) => {
      if (err) resolve({ error: 'Connection hiccup — try again' });
      else resolve(res ?? {});
    });
  });
}

const KEY = 'unohaven.session';
export const session = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) ?? null; } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

export const prefs = {
  get(k, d) { try { const v = localStorage.getItem(`unohaven.${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`unohaven.${k}`, JSON.stringify(v)); } catch { /* ignore */ } },
};
