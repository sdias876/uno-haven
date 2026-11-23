import { io } from 'socket.io-client';

// Same-origin in production (server hosts the client); Vite proxies /socket.io in dev.
// Set VITE_SERVER_URL when the client is deployed separately (e.g. Vercel + Render).
const URL = import.meta.env.VITE_SERVER_URL || undefined;

export const socket = io(URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  transports: ['websocket', 'polling'],
});

/** Emit with an ack, as a promise. Resolves { error } on timeout instead of hanging. */
export function send(event, payload = {}, timeoutMs = 6000) {
  return new Promise((resolve) => {
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
