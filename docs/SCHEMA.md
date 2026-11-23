# State schema & socket protocol

The server is the **single source of truth**. Clients send *intents* (`game:play`, `game:draw`, …); the server validates every one against the engine and broadcasts a personalised view. A client never sees another player's hand (unless it is a spectator and the host allows it), never sees the draw pile order, and cannot play a card it doesn't hold or that isn't legal.

## 1. Room (in memory, `server/src/rooms.js`)

```ts
Room {
  code: string                 // 5 chars, no 0/O/1/I, e.g. "7MLQL"
  hostId: PlayerId
  phase: 'lobby' | 'playing' | 'ended'
  rules: Rules                 // house-rule toggles (below)
  settings: { turnSeconds: 0|15|30|60, spectatorsSeeHands: boolean }
  seats: Seat[]                // max 6, ordered = turn order
  spectators: Map<SocketId, { name, avatar }>
  game: UnoGame | null
  recap: Recap | null          // set when phase === 'ended'
  chat: ChatMsg[]              // last 80
  rematchVotes: Set<PlayerId>
  matchNumber: number
  timers: { turn, bot, catch[], reclaim: Map<PlayerId, Timeout>, ttl }
}

Seat {
  id: PlayerId                 // "p_…" for humans, "bot_…" for bots
  token: string | null         // secret seat token, stored in the player's localStorage
  name: string; avatar: string
  isBot: boolean; botLevel: 'casual'|'tactical'|'ruthless'|null
  socketId: string | null; connected: boolean
  autopilot: boolean           // bot is playing for an absent / AFK human
  afkStrikes: number           // 3 timeouts in a row → autopilot until they act
}

Rules { stacking: boolean; sevenZero: boolean; forcePlay: boolean; jumpIn: boolean }
```

## 2. Game (authoritative engine, `server/src/game/engine.js`)

```ts
Card { id: string; color: 'red'|'yellow'|'green'|'blue'|'wild'; value: '0'..'9'|'skip'|'reverse'|'draw2'|'wild'|'wild4' }

UnoGame {
  players: { id, name, hand: Card[], preCalledUno: boolean }[]
  drawPile: Card[]             // crypto-shuffled; reshuffles discards when empty
  discardPile: Card[]
  currentColor: Color          // differs from top card after a wild
  direction: 1 | -1
  turn: number                 // index into players
  pendingDraw: number          // open stack total (stacking rule)
  pendingType: 'draw2'|'wild4'|null
  drawnCardId: string|null     // card drawn this turn that may still be played
  unoVulnerable: PlayerId|null // on 1 card without calling UNO → catchable until next action
  lacks: { [playerId]: { [color]: turnNumber } } // public inference used by smart bots
  stats: { [playerId]: PlayerStats }             // telemetry for the recap
  log: LogEntry[]              // replay timeline
  phase: 'playing'|'ended'; winnerId; score
}
```

### Personalised view sent to each socket (`room:state`)

```ts
{
  room: { code, phase, hostId, rules, settings, maxSeats, matchNumber, turnMsLeft,
          seats: [{ id, name, avatar, isBot, botLevel, connected, autopilot }],
          spectators: [{ name, avatar }], rematchVotes: PlayerId[], recap },
  game: { phase, top, recentDiscards, drawCount, currentColor, direction, turnPlayerId, turnNumber,
          pendingDraw, pendingType, drawnCardId, unoVulnerable, winnerId, score, rules,
          players: [{ id, name, cardCount, hand? }],  // hand only for spectators / after the match
          hand: Card[],          // YOUR cards
          playable: CardId[],    // server-computed legal moves → drives the glow/dim UI
          canPass: boolean },
  me: { id, role: 'player'|'spectator', isHost }
}
```

## 3. Socket events

| Client → server | Payload | Notes |
|---|---|---|
| `room:create` | `{ name, avatar }` | returns `{ code, token, playerId }` |
| `room:join` | `{ code, name, avatar, token? }` | token reclaims your seat; full/running table → spectator |
| `room:leave` | – | mid-game, a bot keeps your seat |
| `lobby:addBot` / `lobby:removeSeat` / `lobby:botLevel` | `{ level }` / `{ playerId }` / `{ playerId, level }` | host only |
| `lobby:rules` | `{ rules?, settings? }` | host only |
| `lobby:start` / `lobby:backToLobby` / `lobby:takeSeat` | – | |
| `game:play` | `{ cardId, color?, swapTargetId? }` | `color` required for wilds, `swapTargetId` for 7 under 7-0 |
| `game:draw` / `game:pass` / `game:uno` | – | `game:uno` with 2 cards pre-arms the call |
| `game:catch` | `{ targetId }` | target draws 2 if they forgot UNO |
| `game:hint` | – | returns `{ hint: { cardId, color?, action?, tip } }` |
| `game:rematch` | – | host starts instantly; others vote |
| `social:chat` / `social:emote` | `{ text }` / `{ emoji }` | rate-limited |

| Server → client | Payload |
|---|---|
| `room:state` | personalised view (above) |
| `game:fx` | `[{ type: 'play'|'draw'|'penalty'|'stack'|'skip'|'reverse'|'swap'|'rotate'|'jumpIn'|'uno'|'caught'|'takeover'|'win'|… }]` – drives sounds, banners, screen shake |
| `social:chat` / `social:emote` | chat message / floating reaction |

## 4. Optional persistence (Postgres)

The game runs fully in memory, which is right for live rooms (sub-millisecond updates, no DB round-trips). If you later want accounts, leaderboards or match history, persist **finished matches** only:

```sql
create table players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  created_at timestamptz default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  rules jsonb not null,               -- { stacking, sevenZero, forcePlay, jumpIn }
  winner_name text not null,
  score int not null,
  total_turns int not null,
  recap jsonb not null,               -- full Smart Match Recap incl. timeline
  finished_at timestamptz default now()
);

create table match_players (
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id),
  seat_name text not null,
  is_bot boolean not null,
  bot_level text,
  cards_left int, cards_played int, cards_drawn int,
  uno_calls int, caught_others int, avg_turn_ms int,
  primary key (match_id, seat_name)
);
```

Hook point: `Room.afterAction()` in `rooms.js`, where `this.recap = this.game.recap()` is set.

## 5. Scaling past one server

Rooms live in one Node process. One small instance comfortably handles hundreds of concurrent tables. To run several instances, add the `@socket.io/redis-adapter` and use sticky sessions (room affinity) on your load balancer so a room's sockets land on the process that owns its timers.
