import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomManager } from './rooms.js';
import { attachHandlers } from './handlers.js';

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

attachHandlers(io, rooms);

server.listen(PORT, () => console.log(`🃏 Ek Haven server listening on http://localhost:${PORT}`));

export { app, server, io, rooms };
