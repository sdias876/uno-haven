// Online lobby in Spade Haven's style: pick a room type, see live tables, create one.
// Then the "waiting for players" table, where computer players fill empty seats after a countdown.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../lib/store.jsx';
import { Avatar } from './Avatar.jsx';
import { TableShape } from './TableShape.jsx';
import { P, fmt, onWallet } from '../shell/wallet.js';
import { cityForBet, cityOf } from '../lib/city.js';
import { play } from '../lib/sound.js';
import { ChatPanel } from './Social.jsx';

export const ROOM_TYPES = [
  { size: 2, name: '1 VS 1', sub: 'Just you and one rival', img: 'ek-mode-2', art: 'ek-mode-2' },
  { size: 3, name: '3 PLAYERS', sub: 'A three-way battle', img: 'ek-mode-3', art: 'ek-mode-3' },
  { size: 4, name: '4 PLAYERS', sub: 'The classic full table', img: 'ek-mode-4', art: 'ek-mode-4' },
];
const BET_STEPS = [100, 500, 1000, 2500, 5000, 10000];
const short = (n) => (n >= 1000 ? `${n / 1000}K` : String(n));
const typeOf = (size) => ROOM_TYPES.find((t) => t.size === size) ?? ROOM_TYPES[2];
const click = () => { try { play('pop'); } catch { /* no sound */ } };

function useCoins() {
  const [coins, setCoins] = useState(P.coins);
  useEffect(() => onWallet(() => setCoins(P.coins)), []);
  return coins;
}

const CoinIcon = ({ size = 26 }) => <img src="/ui/coins.webp" alt="" aria-hidden="true" style={{ width: size, height: size }} className="object-contain" />;

/** Where the other seats sit around a small table, by how many there are (you are always at the bottom). */
const SPOTS = { 1: ['top'], 2: ['left', 'right'], 3: ['left', 'top', 'right'] };

export function OnlineLobby({ onClose, onNeedCoins }) {
  const { actions, connected, toast } = useGame();
  const coins = useCoins();
  const [size, setSize] = useState(4);
  const [betF, setBetF] = useState(null);
  const [live, setLive] = useState(null);
  const [online, setOnline] = useState(null);
  const [creating, setCreating] = useState(null); // null | 'pick' | size
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    const load = async () => {
      if (!connected) return;
      const res = await actions.listTables();
      if (on && res?.ok) { setLive(res.tables); setOnline(res.online); }
    };
    load();
    const t = setInterval(load, 3000);
    return () => { on = false; clearInterval(t); };
  }, [actions, connected]);

  const tables = useMemo(() => (live ?? [])
    .filter((t) => t.size === size && (betF === null || t.bet === betF))
    .sort((a, b) => Number(b.phase === 'waiting') - Number(a.phase === 'waiting') || a.bet - b.bet), [live, size, betF]);

  const cycleBet = (dir) => {
    const opts = [null, ...BET_STEPS];
    setBetF(opts[(opts.indexOf(betF) + dir + opts.length) % opts.length]);
  };
  const cycleSize = (dir) => {
    const i = ROOM_TYPES.findIndex((t) => t.size === size);
    setSize(ROOM_TYPES[(i + dir + ROOM_TYPES.length) % ROOM_TYPES.length].size);
  };

  const run = async (fn) => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const sit = (t) => {
    if (t.phase !== 'waiting' || t.seats.length >= t.size) return;
    if (coins < t.bet) { onNeedCoins(t.bet); return; }
    click();
    run(async () => { const r = await actions.joinRoom(t.code); if (!r.error) onClose(); });
  };
  const watch = (t) => { click(); run(async () => { const r = await actions.watchTable(t.code); if (!r.error) onClose(); }); };
  const create = (sz, bet) => {
    if (coins < bet) { onNeedCoins(bet); return; }
    setCreating(null);
    run(async () => {
      if (!connected) {
        // no game server: play the same table against the computer on this device
        toast('Playing against the computer while the game server wakes up');
        await actions.quickPlay(Array.from({ length: sz - 1 }, () => 'smart'), undefined, { bet });
        onClose();
        return;
      }
      const r = await actions.quickTable(sz, bet);
      if (!r.error) onClose();
    });
  };

  const type = typeOf(size);
  const ui = (
    <div className="ol-screen" role="dialog" aria-label="Online lobby">
      <header className="ol-head">
        <button className="ol-back" onClick={() => { click(); onClose(); }} aria-label="Back to menu">
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="ol-box">
          <span className="ol-label">ROOM TYPE</span>
          <div className="ol-ctl">
            <button aria-label="Previous room type" onClick={() => cycleSize(-1)}>‹</button>
            <b className="ol-type"><img className="ol-mode-img" src={`/ui/${type.img}.webp`} alt="" aria-hidden="true" />{type.name}</b>
            <button aria-label="Next room type" onClick={() => cycleSize(1)}>›</button>
          </div>
        </div>
        <div className="ol-box">
          <span className="ol-label">BET</span>
          <div className="ol-ctl">
            <button aria-label="Lower bet filter" onClick={() => cycleBet(-1)}>−</button>
            <b>{betF === null ? 'ANY' : short(betF)}</b>
            <button aria-label="Higher bet filter" onClick={() => cycleBet(1)}>+</button>
          </div>
        </div>
        <div className="ol-coins"><CoinIcon size={34} /><span>{fmt(coins)}</span></div>
      </header>

      <div className="lt-row">
        <button className="lt-create" onClick={() => { click(); setCreating('pick'); }} aria-label="Create a table">
          <img className="lt-create-img" src="/ui/ol-create.webp" alt="" aria-hidden="true" draggable={false} />
          <span className="lt-create-txt">CREATE TABLE</span>
        </button>
        {tables.map((t) => <LobbyTable key={t.code} t={t} poor={coins < t.bet} onJoin={() => sit(t)} onWatch={() => watch(t)} />)}
        {tables.length === 0 && (
          <div className="lt-empty" role="status">
            <img className="lt-empty-img" src="/ui/ol-empty.webp" alt="" aria-hidden="true" draggable={false} />
            <div className="lt-empty-txt">
              {!connected ? (
                <><b>Can’t reach the game server</b><p>Live tables show up here when you’re online. You can still create a table and play against the computer.</p></>
              ) : live === null ? (
                <b>Looking for tables…</b>
              ) : (
                <><b>No one is playing {type.name} right now</b>
                  <p>Tables with real players show up here as soon as someone sits down. Create one and others can join you.</p></>
              )}
              {live !== null || !connected ? <button className="lt-empty-btn" onClick={() => { click(); setCreating('pick'); }}>CREATE A TABLE</button> : null}
            </div>
          </div>
        )}
      </div>

      {creating === 'pick' && (
        <RoomTypePicker live={live} online={connected ? online : null} onClose={() => setCreating(null)}
          onPick={(sz) => { click(); setSize(sz); setCreating(sz); }} />
      )}
      {typeof creating === 'number' && (
        <CreateTable size={creating} coins={coins} onClose={() => setCreating(null)} onCreate={(bet) => create(creating, bet)} onNeedCoins={onNeedCoins} />
      )}
    </div>
  );
  return createPortal(ui, document.body);
}

function LobbyTable({ t, poor, onJoin, onWatch }) {
  const [cityKey, cityName] = cityForBet(t.bet);
  const waiting = t.phase === 'waiting';
  const canSit = waiting && t.seats.length < t.size;
  const humans = t.seats.filter((s) => !s.isBot).length;
  // seats shown around the table: everyone already there, then empty seats; yours is the PLAY button at the bottom
  const shown = canSit ? [...t.seats, ...Array(Math.max(0, t.size - 1 - t.seats.length)).fill(null)] : t.seats.slice(1);
  const bottom = canSit ? null : t.seats[0];
  const spots = SPOTS[shown.length] ?? SPOTS[3];
  return (
    <div className={`lt tbl ${poor ? 'poor' : ''} ${waiting ? '' : 'busy'}`}>
      <TableShape scale={0.62} emblem={false} />
      <div className="lt-felt">
        <div className="lt-city"><span>{cityName}</span></div>
        <div className="lt-pills">
          <span className="lt-pill">{short(t.bet)} <CoinIcon size={34} /></span>
          <span className="lt-pill">{typeOf(t.size).name}</span>
        </div>
        <span className="lt-status">{waiting ? `${humans} real player${humans === 1 ? '' : 's'} waiting` : 'GAME IN PROGRESS'}</span>
      </div>
      {shown.map((s, i) => (
        <span key={i} className={`lt-seat at-${spots[i]}`}>
          {s ? <><span className="lt-ring"><Avatar k={s.avatar} size={74} /></span><small className="lt-name">{s.name}</small></> : <span className="lt-q" aria-label="Empty seat" />}
        </span>
      ))}
      {bottom && (
        <span className="lt-seat at-bottom"><span className="lt-ring"><Avatar k={bottom.avatar} size={74} /></span><small className="lt-name">{bottom.name}</small></span>
      )}
      {canSit ? (
        <button className="lt-play" onClick={onJoin} aria-label={`Play at the ${cityName} table, bet ${fmt(t.bet)}`}>
          <span className="lt-arrow">↑</span><b>PLAY</b>
        </button>
      ) : (
        <button className="lt-live" onClick={onWatch} aria-label={`Watch the ${cityName} game`}>👁 WATCH</button>
      )}
    </div>
  );
}

function RoomTypePicker({ live, online, onPick, onClose }) {
  const count = (size) => {
    if (online === null) return 'PLAY VS COMPUTER';
    const n = (live ?? []).filter((t) => t.size === size).reduce((a, t) => a + t.seats.filter((s) => !s.isBot).length, 0);
    return n ? `${n} PLAYER${n === 1 ? '' : 'S'} SEATED` : `${online} ONLINE`;
  };
  return (
    <div className="ol-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rt2" role="dialog" aria-modal="true" aria-label="Choose your table">
        <div className="rt2-title">CHOOSE YOUR TABLE</div>
        <div className="rt2-cards">
          {ROOM_TYPES.map((t) => (
            <div key={t.size} className="mc2">
              <button className="mc2-pick" onClick={() => onPick(t.size)}>
                <span className="mc2-title">{t.name}</span>
                <span className="mc2-sub">{t.sub}</span>
                <span className="mc2-art">
                  <img src={`/ui/${t.art}.webp`} alt="" draggable={false} />
                  <span className="mc2-count">👥 {count(t.size)}</span>
                </span>
              </button>
            </div>
          ))}
        </div>
        <button className="ol-x" onClick={onClose} aria-label="Close">✕</button>
      </div>
    </div>
  );
}

function CreateTable({ size, coins, onClose, onCreate, onNeedCoins }) {
  const affordable = BET_STEPS.filter((b) => b <= Math.max(100, coins));
  const last = Number(localStorage.getItem('ekhaven.lastBet')) || 500;
  const [bi, setBi] = useState(Math.max(0, affordable.indexOf(affordable.includes(last) ? last : affordable[affordable.length - 1] >= 500 ? 500 : 100)));
  const bet = affordable[Math.min(bi, affordable.length - 1)] ?? 100;
  const [cityKey, cityName] = cityForBet(bet);
  return (
    <div className="ol-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ct-modal" role="dialog" aria-modal="true" aria-label="Create table">
        <div className="ct-hero" style={{ backgroundImage: `url(/ui/city/${cityKey}.webp)` }}>
          <div className="ct-head">CREATE <span>{typeOf(size).name}</span> TABLE</div>
          <div className="ct-city" key={cityName}>{cityName}</div>
        </div>
        <div className="ct-bet">
          <div className="ct-bubble"><img src="/ui/coins.webp" alt="" aria-hidden="true" /><span>BET {short(bet)}</span></div>
          <div className="ct-slider">
            <button className="ct-round" aria-label="Lower bet" onClick={() => setBi(Math.max(0, bi - 1))}>−</button>
            <input type="range" min={0} max={affordable.length - 1} value={Math.min(bi, affordable.length - 1)} onChange={(e) => setBi(+e.target.value)} aria-label="Bet" />
            <button className="ct-round" aria-label="Raise bet" onClick={() => setBi(Math.min(affordable.length - 1, bi + 1))}>+</button>
          </div>
          <div className="ct-prize"><CoinIcon size={20} /> Winner takes {fmt(bet * size)} coins</div>
        </div>
        <div className="ct-note">Real players can join your table. Any seat still empty after 30 seconds gets a computer player.</div>
        {coins < bet
          ? <button className="ct-play gold" onClick={() => onNeedCoins(bet)}>GET COINS</button>
          : <button className="ct-play" onClick={() => { localStorage.setItem('ekhaven.lastBet', String(bet)); click(); onCreate(bet); }}>PLAY NOW</button>}
        <button className="ol-x" onClick={onClose} aria-label="Close">✕</button>
      </div>
    </div>
  );
}

/** A public table before it starts: seats fill up, then computer players join when the countdown runs out. */
export function PublicWait() {
  const { room, me, actions } = useGame();
  const [chatOpen, setChatOpen] = useState(false);
  const deadline = useRef(null);
  const [, tick] = useState(0);
  useEffect(() => { deadline.current = room.fillMsLeft != null ? Date.now() + room.fillMsLeft : null; }, [room]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(t); }, []);
  const secs = deadline.current ? Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)) : null;

  const city = cityOf(room);
  const size = room.maxSeats;
  const mine = room.seats.findIndex((s) => s.id === me?.id);
  // everyone else in seat order starting after you, then the empty seats
  const others = [...room.seats.slice(mine + 1), ...room.seats.slice(0, Math.max(0, mine))];
  const shown = [...others, ...Array(Math.max(0, size - 1 - others.length)).fill(null)];
  const spots = SPOTS[shown.length] ?? SPOTS[3];
  const myself = room.seats[mine];

  return (
    <div className="felt tbl pw h-full flex flex-col overflow-hidden">
      <div className="tbl-scene" style={{ backgroundImage: `url(/ui/city/${city[0]}.webp)` }} aria-hidden />
      <header className="pw-head">
        <button className="ol-back" onClick={() => { click(); actions.leave(); }} aria-label="Leave table">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button className="round-ui ml-auto" onClick={() => setChatOpen((o) => !o)} aria-label="Chat"><img src="/ui/chat-bubbles.webp" alt="" className="w-9 h-9 object-contain" /></button>
      </header>
      <div className="pw-stage">
        <div className="pw-table">
          <TableShape />
          <div className="pw-felt">
            <div className="lt-city"><span>{city[1]}</span></div>
            <div className="lt-pills">
              <span className="lt-pill">{short(room.settings.bet)} <CoinIcon size={38} /></span>
              <span className="lt-pill">{typeOf(size).name}</span>
            </div>
            <div className="pw-text">WAITING FOR PLAYERS<span className="dots3"><i>.</i><i>.</i><i>.</i></span></div>
          </div>
          {shown.map((s, i) => (
            <span key={s?.id ?? `e${i}`} className={`lt-seat pw-seat at-${spots[i]}`}>
              {s ? <><span className="lt-ring big"><Avatar k={s.avatar} size={92} /></span><small className="lt-name">{s.name}</small></> : <span className="lt-q big" aria-label="Empty seat" />}
            </span>
          ))}
          {myself && (
            <span className="lt-seat pw-seat at-bottom me"><span className="lt-ring big"><Avatar k={myself.avatar} size={92} /></span><small className="lt-name">{myself.name} (you)</small></span>
          )}
        </div>
        <div className="pw-actions">
          <span className="pw-wait" role="timer">
            {room.seats.length >= size ? 'Table full — starting…'
              : secs != null ? <>Waiting for player {room.seats.length + 1} · a computer player joins in <b>{secs}s</b></> : 'Starting…'}
          </span>
          {me?.role === 'player' && room.seats.length < size && <button className="pw-now" onClick={() => { click(); actions.fillNow(); }}>START NOW</button>}
        </div>
      </div>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
