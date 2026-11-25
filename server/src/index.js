import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomManager } from './rooms.js';
import { attachHandlers } from './handlers.js';
import * as accounts from './accounts/accounts.js';

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

// Old addresses -> the main address (set CANONICAL_URL, e.g. https://ek.sedigitaltransformation.com). Pages only;
// the game connection and the account API keep working on every address.
const CANONICAL = String(process.env.CANONICAL_URL || '').replace(/\/+$/, '');
if (CANONICAL) {
  const canonHost = new URL(CANONICAL).host;
  app.use((req, res, next) => {
    const host = String(req.headers.host || '').toLowerCase();
    // Only page visits move; files (incl. the offline app's sw.js and precache) are still served so installed
    // copies can update themselves, and the updated app then moves to the main address on its own.
    const isPage = req.headers['sec-fetch-mode'] === 'navigate' || (!path.extname(req.path) && /text\/html/.test(req.headers.accept || ''));
    if (req.method === 'GET' && isPage && host.endsWith('.onrender.com') && host !== canonHost && !/^\/(api|socket\.io|healthz)/.test(req.path)) {
      return res.redirect(301, CANONICAL + req.originalUrl);
    }
    next();
  });
}

// ---- email accounts (Brevo for email, Upstash for storage; same setup as Sequence Haven) ----
const AUTH_ROUTES = { signup: accounts.signUp, signin: accounts.signIn, load: accounts.load, save: accounts.save,
  password: accounts.changePassword, forgot: accounts.forgot, reset: accounts.reset };
const authHits = new Map(); // ip -> {n, t}: simple brake on password guessing
app.get('/api/auth/config', (_req, res) => res.set('Cache-Control', 'no-store').json(accounts.config()));
app.post('/api/auth/:route', express.json({ limit: '64kb' }), async (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  const route = req.params.route, fn = AUTH_ROUTES[route];
  if (!fn) return res.status(404).json({ error: 'Not found' });
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Forbidden' }); } catch { return res.status(403).json({ error: 'Forbidden' }); } }
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (['signin', 'signup', 'forgot', 'reset', 'password'].includes(route)) {
    const now = Date.now(), h = authHits.get(ip) || { n: 0, t: now };
    if (now - h.t > 10 * 60000) { h.n = 0; h.t = now; }
    if (++h.n > 30) return res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' });
    authHits.set(ip, h); if (authHits.size > 20000) authHits.clear();
  }
  try { res.json(await fn(req.body || {})); }
  catch (e) {
    if (e instanceof accounts.AuthError) res.status(e.status).json({ error: e.message });
    else { console.error('auth', route, e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
  }
});

// In production the server also hosts the built React client (single deploy).
const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get(['/privacy', '/privacy/'], (_req, res) => res.sendFile(path.join(dist, 'privacy.html')));
  app.get(/^\/(?!socket\.io|healthz|api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

attachHandlers(io, rooms);

server.listen(PORT, () => console.log(`🃏 Ek Haven server listening on http://localhost:${PORT}`));

export { app, server, io, rooms };
