import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from './Avatar.jsx';
import { useState } from 'react';
import { useGame } from '../lib/store.jsx';
import { ChatPanel } from './Social.jsx';
import { TableShape } from './TableShape.jsx';
import { P, fmt } from '../shell/wallet.js';
import { cityOf } from '../lib/city.js';

const BET_CHOICES = [0, 100, 500, 1000, 2500, 5000, 10000];

const RULES = [
  { key: 'stacking', icon: '🥞', title: 'Stacking', desc: '+2 on +2, +4 on +4 — the unlucky one draws the total.' },
  { key: 'sevenZero', icon: '🔄', title: '7-0 Rule', desc: 'A 7 swaps hands with a player you choose; a 0 rotates every hand.' },
  { key: 'forcePlay', icon: '👉', title: 'Force Play', desc: 'If you draw a playable card, you must play it.' },
  { key: 'jumpIn', icon: '⚡', title: 'Jump-In', desc: 'Hold an exact duplicate of the top card? Slam it down out of turn.' },
];
const LEVELS = [
  { key: 'smart', label: 'Auto', icon: '✨', desc: 'Adapts to how well the table plays' },
  { key: 'casual', label: 'Chill', icon: '😊', desc: 'Relaxed, sometimes forgets to call Ek' },
  { key: 'tactical', label: 'Classic', icon: '🧠', desc: 'Tracks cards, saves wilds' },
  { key: 'ruthless', label: 'Ruthless', icon: '😈', desc: 'Disrupts colors, catches everything' },
];
const levelName = (k) => LEVELS.find((l) => l.key === k)?.label ?? k;
// Seats around the table, clockwise from your left (you sit at the bottom).
const SPOTS = ['left', 'tl', 'top', 'tr', 'right'];

function Toggle({ on, onChange, disabled }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!on)} aria-pressed={on}
      className={`relative w-11 h-6 rounded-full transition shrink-0 ${on ? 'bg-emerald-500' : 'bg-white/20'} ${disabled ? 'opacity-60' : ''}`}>
      <motion.span layout className="absolute top-1 w-4 h-4 rounded-full bg-white shadow" style={{ left: on ? 24 : 4 }} />
    </button>
  );
}

/** Private table before the deal: everything on one screen — the table with its seats, the house rules, and the Deal button. */
export function Lobby() {
  const { room, me, actions, toast } = useGame();
  const [chatOpen, setChatOpen] = useState(false);
  const [adding, setAdding] = useState(null); // seat spot showing the bot menu
  const isHost = me?.isHost;
  const spectator = me?.role === 'spectator';
  const inviteUrl = `${window.location.origin}/?room=${room.code}`;
  const full = room.seats.length >= room.maxSeats;
  const city = cityOf(room);
  const bet = room.settings.bet ?? 0;

  const copy = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); toast('Invite link copied — send it to friends!', 'good'); }
    catch { toast(inviteUrl); }
  };

  const mine = room.seats.findIndex((s) => s.id === me?.id);
  const start = mine >= 0 ? mine : 0;
  const ordered = [...room.seats.slice(start), ...room.seats.slice(0, start)];
  const bottom = mine >= 0 ? ordered[0] : null;
  const others = mine >= 0 ? ordered.slice(1) : ordered;
  const spots = SPOTS.map((pos, i) => ({ pos, seat: others[i] ?? null }));
  const freeSeats = room.maxSeats - room.seats.length;
  let shownEmpty = 0;

  const seatView = (s, pos) => (
    <div key={s.id} className={`lb-seat at-${pos}`}>
      <span className={`lt-ring ${s.id === me?.id ? 'me' : ''}`}><Avatar k={s.avatar} size={72} /></span>
      {s.id === room.hostId && <span className="lb-crown" title="Host">👑</span>}
      {isHost && s.id !== me?.id && (
        <button onClick={() => actions.removeSeat(s.id)} className="lb-x" aria-label={`Remove ${s.name}`}>✕</button>
      )}
      <span className="lb-name">{s.name}{s.id === me?.id ? ' (you)' : ''}</span>
      {s.isBot && (isHost ? (
        <select value={s.botLevel} onChange={(e) => actions.botLevel(s.id, e.target.value)} className="lb-level" aria-label={`${s.name}'s level`}>
          {LEVELS.map((l) => <option key={l.key} value={l.key} className="text-black">{l.label}</option>)}
        </select>
      ) : <span className="lb-level">{levelName(s.botLevel)}</span>)}
      {!s.isBot && !s.connected && <span className="lb-level">Reconnecting…</span>}
    </div>
  );

  return (
    <div className="felt tbl lb h-full flex flex-col overflow-hidden">
      <div className="tbl-scene" style={{ backgroundImage: `url(/ui/city/${city[0]}.webp)` }} aria-hidden />

      <header className="lb-head">
        <button className="ol-back lb-back" onClick={actions.leave} aria-label="Leave table">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="lb-title">
          <span>{city[1].toUpperCase()} TABLE</span>
          <b>{room.code}</b>
        </div>
        <button onClick={copy} className="lb-invite" title={inviteUrl}><img src="/ui/invite.webp" alt="" /><span className="lb-inv-long">COPY INVITE LINK</span><span className="lb-inv-short">INVITE</span></button>
        <button className="round-ui" onClick={() => setChatOpen((o) => !o)} aria-label="Chat"><img src="/ui/chat-bubbles.webp" alt="" className="w-9 h-9 object-contain" /></button>
      </header>

      <div className="lb-main">
        <section className="lb-stage" onClick={(e) => { if (e.target === e.currentTarget) setAdding(null); }}>
          <div className="lb-table">
            <TableShape />
            <div className="lb-felt">
              <div className="lt-city"><span>{city[1]}</span></div>
              <div className="lb-pills">
                <span className="lt-pill">{bet ? <>{fmt(bet)} <img src="/ui/coins.webp" alt="" className="w-8 h-8 object-contain" /></> : 'NO BET'}</span>
                <span className="lt-pill">{room.seats.length}/{room.maxSeats} PLAYERS</span>
              </div>
              {isHost ? (
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={actions.start} disabled={room.seats.length < 2} className="lb-deal">
                  {room.seats.length < 2 ? 'TAP + TO ADD A PLAYER' : `DEAL ${room.seats.length} PLAYERS`}
                </motion.button>
              ) : spectator && !full ? (
                <button onClick={actions.takeSeat} className="lb-deal">TAKE A SEAT</button>
              ) : (
                <div className="lb-wait">Waiting for the host to deal<span className="dots3"><i>.</i><i>.</i><i>.</i></span></div>
              )}
              {room.seats.length >= 2 && bet > 0 && <div className="lb-sub">Winner takes {fmt(bet * room.seats.length)} coins · you have {fmt(P.coins)}</div>}
            </div>

            {spots.map(({ pos, seat }) => {
              if (seat) return seatView(seat, pos);
              if (shownEmpty >= freeSeats) return null;
              shownEmpty++;
              return (
                <div key={pos} className={`lb-seat at-${pos} ${adding === pos ? 'open' : ''}`}>
                  {isHost ? (
                    <button className="lb-add" onClick={() => setAdding(adding === pos ? null : pos)} aria-label="Add a computer player"><span>+</span></button>
                  ) : <span className="lt-q lb-q" aria-label="Empty seat" />}
                  <span className="lb-name dim">{isHost ? 'Add bot' : 'Empty'}</span>
                  <AnimatePresence>
                    {adding === pos && (
                      <motion.div className={`lb-menu ${pos === 'right' || pos === 'tr' ? 'flip' : ''}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                        {LEVELS.map((l) => (
                          <button key={l.key} title={l.desc} onClick={() => { actions.addBot(l.key); setAdding(null); }}>
                            <span>{l.icon}</span>{l.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {bottom && seatView(bottom, 'bottom')}
          </div>
          {room.spectators.length > 0 && <div className="lb-watch">👀 Watching: {room.spectators.map((s) => s.name).join(', ')}</div>}
        </section>

        <aside className="lb-rules">
          <div className="lb-rules-head">HOUSE RULES{!isHost && <small>Host decides</small>}</div>
          <ul>
            {RULES.map((r) => (
              <li key={r.key} title={r.desc}>
                <span className="lb-ic">{r.icon}</span>
                <div className="min-w-0 flex-1"><b>{r.title}</b><small>{r.desc}</small></div>
                <Toggle on={room.rules[r.key]} disabled={!isHost} onChange={(v) => actions.setRules({ [r.key]: v })} />
              </li>
            ))}
          </ul>
          <div className="lb-sets">
            <label>
              <img src="/ui/coins.webp" alt="" className="w-7 h-7 object-contain" /><b>Table bet</b>
              <select disabled={!isHost} value={bet} onChange={(e) => actions.setRules({}, { bet: Number(e.target.value) })}>
                {BET_CHOICES.map((b) => <option key={b} value={b} className="text-black">{b ? fmt(b) : 'No bet'}</option>)}
              </select>
            </label>
            <label title="Autopilot plays when time runs out">
              <span className="lb-ic">⏱️</span><b>Turn timer</b>
              <select disabled={!isHost} value={room.settings.turnSeconds} onChange={(e) => actions.setRules({}, { turnSeconds: Number(e.target.value) })}>
                {[15, 30, 60, 0].map((s) => <option key={s} value={s} className="text-black">{s ? `${s}s` : 'Off'}</option>)}
              </select>
            </label>
            <label title="Great for streaming & teaching">
              <span className="lb-ic">👀</span><b>Spectators see hands</b>
              <Toggle on={room.settings.spectatorsSeeHands} disabled={!isHost} onChange={(v) => actions.setRules({}, { spectatorsSeeHands: v })} />
            </label>
          </div>
        </aside>
      </div>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
