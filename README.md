# 🃏 UNO Haven

UNO Haven is a multiplayer UNO-style card game that runs in the browser. Each move is checked by the server, so players can't cheat. It also has smart bots, a coach that suggests moves, house rules, voice "UNO!" calls, spectators, and a recap screen after every match. It works on desktop and mobile browsers.

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS v4, Framer Motion |
| Realtime | Node.js + Express + Socket.io (authoritative server, reconnect tokens) |
| Audio | Web Audio API: every sound is synthesised, so there are no files to load and playback is instant. Speech Synthesis speaks the "UNO!" callout |
| Voice | Web Speech API (`SpeechRecognition`) to shout "UNO!" (Chrome, Edge and Safari) |
| Tests | `node:test`: engine rules, simulations of 240 bot-only games, socket end-to-end |

---

## Features

**Smart, but simple: the clever parts run in the background**
- **Play now runs on your device.** Solo games use the same rules engine and bots as the server, running inside your browser. Games start instantly with no lag, and they keep working with no internet. Playing with friends uses the online server.
- **Installable app.** Add it to the home screen on phones, tablets and Chromebooks, or use 📲 Install app in Chrome or Edge. It opens full screen like a native app, and once installed it loads even when you're offline.
- **Auto bots that adapt.** These are the default. After you win they play a little tougher, and after you lose they ease off. The level is remembered between games, so nobody has to pick a difficulty.
- **Tips at the right moment.** The first time a Skip, +4, stack, 7-swap, missed UNO and so on happens, a one-line tip explains it. Each tip shows only once.
- **One ☰ menu.** Sound, Smart Coach, tips, voice UNO, chat, invite and leave all live in one menu, so the table shows only the game.

**Easy to understand**
- The table stays uncluttered: your fanned hand at the bottom, the draw and discard piles in the center, and a glowing ring that shows the active color and spins in the direction of play.
- The **server** works out which of your cards are legal. Those cards glow and lift up; the rest dim on your turn.
- An optional **interactive 3-step tutorial** (about 45 seconds) opens on your first visit: match color or number → action cards → hit UNO.
- Hint lines under the piles tell you what to do: *"Your turn — match green or 3 · 12s"*.
- Keyboard shortcuts: `D` draw, `P` pass, `U` UNO, `H` hint.

**Smart tech**
- **Smart Coach** (can be turned off): 💡 highlights the best card and gives a one-line reason, e.g. *"Play your Yellow Skip now to block Viper, who only has 2 cards left."* If you play a wild, the coach also suggests a color in the color picker.
- **Three bot levels**:
  - *Casual* plays loosely and sometimes forgets to call UNO.
  - *Tactical* tracks played cards, saves its wilds and always calls UNO.
  - *Ruthless* also keeps its Wild Draw Four for emergencies. It notices which colors each opponent has drawn on (a sign they have none of that color) and switches to those colors to disrupt players down to 1–2 cards. It catches forgotten UNO calls in under 1.5 s.
  - In 3,000 simulated three-way games, the win rates were Ruthless 37%, Tactical 34%, Casual 29%. UNO is mostly luck, but the difference is real.
- **AFK takeover**: each turn has a 15 s timer (the host can pick 15, 30 or 60 s, or turn it off). When it runs out, a Tactical bot plays that turn. After 3 timeouts in a row, autopilot stays on until the player acts again.
- **Reconnect window**: if you drop out, your seat is kept for 60 s and autopilot plays for you meanwhile. Reload or reopen the link and you're back in the same seat, because a secret seat token is stored in localStorage. After 60 s a bot takes the seat for good, so the game never stalls.
- **Voice UNO**: turn on 🎤 and say "UNO!". The big red UNO button always works as a fallback.

**Extras**
- **House rules lobby**: Stacking (+2 on +2, +4 on +4), the 7-0 rule (choose who to swap with; 0 rotates all hands), Force Play, Jump-In, the turn timer, and whether spectators can see hands.
- **Social**: 10 quick emotes that float up from your seat, a live mini-chat, a screen shake and dramatic boom on a +4, and big banners for Skip, Reverse, Stack and UNO.
- **Invite link and spectators**: one click copies `https://your-site/?room=CODE` (on mobile it opens the share sheet). Anyone who joins a full table or a game already in progress becomes a spectator, can see the live hands, and can send reactions.
- **Smart Match Recap**: Most Ruthless Move (biggest penalty dealt and who it hit), Longest UNO Streak, Fastest Hands, a per-player stats table, the cards left in each hand, and a replay timeline.
- A one-click **Rematch with same group** button.
- **Accessibility**: respects the OS "reduce motion" setting, uses aria labels on cards, and announces the turn status to screen readers.

---

## Folder structure

```
uno-haven/
├── package.json              # npm workspaces + root scripts (dev / build / start / test)
├── Dockerfile                # one container: builds client, serves it from the Node server
├── render.yaml               # Render Blueprint (one-click deploy)
├── .env.example
├── docs/
│   └── SCHEMA.md             # room/game state schema, socket protocol, optional Postgres schema
├── server/
│   ├── src/
│   │   ├── index.js          # Express + Socket.io, serves client/dist in prod
│   │   ├── handlers.js       # socket event routing (shared with the in-browser offline server)
│   │   ├── util.js           # Web Crypto randomness (works in Node and browsers)
│   │   ├── rooms.js          # rooms, seats, bots, turn timers, AFK/reconnect, spectators, chat
│   │   └── game/
│   │       ├── cards.js      # 108-card deck, crypto shuffle, points
│   │       ├── engine.js     # AUTHORITATIVE rules engine (validation, turn order, stacking, 7-0, jump-in, UNO, telemetry)
│   │       └── ai.js         # Casual/Tactical/Ruthless bots + Smart Coach
│   └── test/
│       ├── engine.test.js    # rules + 240 simulated bot games (card count is checked after every move)
│       └── e2e.test.js       # real sockets: full match, spectator, reconnect, rematch, AFK takeover
└── client/
    ├── index.html
    ├── vite.config.js        # dev proxy /socket.io → :3001
    └── src/
        ├── main.jsx, App.jsx, index.css
        ├── lib/
        │   ├── socket.js     # socket singleton, ack→promise helper, session/prefs storage
        │   ├── store.jsx     # GameProvider: state, fx → sounds/banners/shake, actions
        │   ├── sound.js      # Web Audio synth (snap, +4 boom, chime, UNO fanfare…) + mute
        │   ├── local.js      # offline mode: runs server/src rooms+engine in the browser
        │   ├── tips.js       # first-time tips
        │   ├── install.js    # "Install app" prompt (PWA)
        │   └── useVoiceUno.js
        └── components/
            ├── Home.jsx      # name/avatar, quick play, private table, join, tutorial
            ├── Tutorial.jsx  # interactive 3-step onboarding
            ├── Lobby.jsx     # seats, bots, house rules, invite link
            ├── Table.jsx     # game table, opponents, piles, coach, UNO button, timers
            ├── Hand.jsx      # fanned, sorted hand with playable glow/lift
            ├── Card.jsx      # CSS/SVG card faces (no image assets)
            ├── Pickers.jsx   # color picker + 7-swap picker
            ├── Social.jsx    # chat, emotes, toasts, banners
            └── Recap.jsx     # Smart Match Recap + rematch
```

The full state schema and socket protocol are in **[docs/SCHEMA.md](docs/SCHEMA.md)**.

---

## Run it locally

Requires **Node 18+** (Node 22 recommended).

```bash
npm install          # installs server + client (npm workspaces)
npm run dev          # server on :3001 (auto-restart) + Vite on :5173
```

Open **http://localhost:5173**. To test multiplayer on one machine, open a second browser profile or an incognito window and paste the invite link. Phones on the same Wi-Fi can join at `http://<your-computer-ip>:5173`.

```bash
npm test             # engine + bot simulations + socket end-to-end (~20 s, includes a 15 s AFK-timer test)
npm run build        # production client build → client/dist
npm start            # production: one server on :3001 serves the game AND the client
```

---

## Deploy it live

Socket.io needs a server that **stays running** with WebSocket support. Serverless platforms such as Vercel functions or Netlify can't host the game server on their own. The easiest setup is a single service that serves both the game and the client.

### Option A: Render (simplest; the Blueprint is included)
1. Push this folder to a GitHub repo.
2. In Render: **New → Blueprint** → pick the repo. It reads `render.yaml`.
3. Wait for the build, then open `https://uno-haven.onrender.com` (or whatever URL Render assigns).

Use a paid instance (Starter). Free instances sleep when idle, and sleeping drops any games in progress.

### Option B: Docker (Fly.io, Railway, a VPS, or your district's servers)
```bash
docker build -t uno-haven .
docker run -p 3001:3001 uno-haven
```
- **Fly.io**: `fly launch` (it detects the Dockerfile), set internal port 3001, then `fly deploy`.
- **Railway**: "Deploy from repo" (it uses the Dockerfile).
- **Behind nginx**: proxy `/socket.io/` with the `Upgrade`/`Connection` headers so WebSockets work.

### Option C: Split hosting (client on Vercel, server on Render or Fly)
- Server: deploy as in A or B, with `CLIENT_ORIGIN=https://your-app.vercel.app`.
- Client: on Vercel set Root Directory = `client`, Build = `npm run build`, Output = `dist`, and the env var `VITE_SERVER_URL=https://your-server.onrender.com`.

Health check: `GET /healthz` returns `{ ok, rooms, uptime }`.

---

## Notes & next steps
- **Name**: "UNO" is a Mattel trademark. A private game for family, friends or a classroom is fine, but if you publish it publicly, rename it (e.g. "ONE Haven" or "Last Card") and keep the original card art, which this project already uses.
- Rooms live in memory, so a server restart ends games in progress. Seat tokens survive a client reload but not a server restart. For scaling and persistence ideas, see `docs/SCHEMA.md` §4–5.
- The game is a single round to 0 cards; points are summed from the other players' hands. A "first to 500" mode would be a small addition in `rooms.js`, since the scoring is already in `engine.finish()`.
- The Wild Draw Four can always be played. The official challenge rule isn't enforced, which is how most casual tables play anyway.
