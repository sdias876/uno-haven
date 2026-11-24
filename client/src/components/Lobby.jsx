import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useGame } from '../lib/store.jsx';
import { ChatPanel } from './Social.jsx';

const RULES = [
  { key: 'stacking', icon: '🥞', title: 'Stacking', desc: '+2 on +2, +4 on +4 — the unlucky one draws the total.' },
  { key: 'sevenZero', icon: '🔄', title: '7-0 Rule', desc: 'A 7 swaps hands with a player you choose; a 0 rotates every hand.' },
  { key: 'forcePlay', icon: '👉', title: 'Force Play', desc: 'If you draw a playable card, you must play it.' },
  { key: 'jumpIn', icon: '⚡', title: 'Jump-In', desc: 'Hold an exact duplicate of the top card? Slam it down out of turn.' },
];
const LEVELS = [
  { key: 'smart', label: 'Auto', icon: '✨', desc: 'Adapts to how well the table plays' },
  { key: 'casual', label: 'Chill', icon: '😊', desc: 'Relaxed, forgets UNO sometimes' },
  { key: 'tactical', label: 'Classic', icon: '🧠', desc: 'Tracks cards, saves wilds' },
  { key: 'ruthless', label: 'Ruthless', icon: '😈', desc: 'Disrupts colors, catches everything' },
];

function Toggle({ on, onChange, disabled }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!on)} aria-pressed={on}
      className={`relative w-12 h-7 rounded-full transition shrink-0 ${on ? 'bg-emerald-500' : 'bg-white/20'} ${disabled ? 'opacity-60' : ''}`}>
      <motion.span layout className="absolute top-1 w-5 h-5 rounded-full bg-white shadow" style={{ left: on ? 24 : 4 }} />
    </button>
  );
}

export function Lobby() {
  const { room, me, actions, toast } = useGame();
  const [chatOpen, setChatOpen] = useState(false);
  const isHost = me?.isHost;
  const spectator = me?.role === 'spectator';
  const inviteUrl = `${window.location.origin}/?room=${room.code}`;
  const full = room.seats.length >= room.maxSeats;

  const copy = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); toast('Invite link copied — send it to friends!', 'good'); }
    catch { toast(inviteUrl); }
  };

  return (
    <div className="felt min-h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <h1 className="font-display text-3xl">Table <span className="tracking-[0.12em] text-gold">{room.code}</span></h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setChatOpen((o) => !o)} className="btn-ghost !py-2">💬 Chat</button>
            <button onClick={actions.leave} className="btn-ghost !py-2">Leave</button>
          </div>
        </div>

        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass rounded-3xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white/60">Invite link</div>
            <div className="text-sm truncate select-all text-white/90">{inviteUrl}</div>
            <div className="text-xs text-white/50 mt-0.5">Friends who join a full or running table watch as spectators.</div>
          </div>
          <button onClick={copy} className="btn-gold">🔗 Copy invite link</button>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Seats */}
          <section className="glass rounded-3xl p-4">
            <div className="flex items-center mb-3">
              <h2 className="font-display text-xl">Players</h2>
              <span className="ml-auto chip bg-white/10">{room.seats.length}/{room.maxSeats}</span>
            </div>
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {room.seats.map((s) => (
                  <motion.li key={s.id} layout initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${s.id === me?.id ? 'bg-gold/15 ring-1 ring-gold/40' : 'bg-white/5'}`}>
                    <span className="text-2xl">{s.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate">{s.name}{s.id === me?.id ? ' (you)' : ''}</div>
                      <div className="text-xs text-white/50">
                        {s.id === room.hostId ? '👑 Host' : s.isBot ? `${{ smart: 'Auto', casual: 'Chill', tactical: 'Classic', ruthless: 'Ruthless' }[s.botLevel] ?? s.botLevel} bot` : s.connected ? 'Ready' : 'Reconnecting…'}
                      </div>
                    </div>
                    {isHost && s.isBot && (
                      <select value={s.botLevel} onChange={(e) => actions.botLevel(s.id, e.target.value)}
                        className="bg-white/10 rounded-lg text-sm px-2 py-1 outline-none">
                        {LEVELS.map((l) => <option key={l.key} value={l.key} className="text-black">{l.label}</option>)}
                      </select>
                    )}
                    {isHost && s.id !== me?.id && (
                      <button onClick={() => actions.removeSeat(s.id)} className="text-white/50 hover:text-rose-400 px-1" aria-label={`Remove ${s.name}`}>✕</button>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {isHost && !full && (
              <div className="mt-3">
                <div className="text-sm text-white/60 mb-1.5">Add a bot</div>
                <div className="grid grid-cols-4 gap-2">
                  {LEVELS.map((l) => (
                    <button key={l.key} onClick={() => actions.addBot(l.key)} className="btn-ghost !flex-col !gap-0 !py-2" title={l.desc}>
                      <span className="text-xl">{l.icon}</span><span className="text-sm">{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {room.spectators.length > 0 && (
              <div className="mt-3 text-sm text-white/60">👀 Watching: {room.spectators.map((s) => s.name).join(', ')}</div>
            )}
            {spectator && !full && <button onClick={actions.takeSeat} className="btn-gold w-full mt-3">Take a seat</button>}
          </section>

          {/* House rules */}
          <section className="glass rounded-3xl p-4">
            <div className="flex items-center mb-3">
              <h2 className="font-display text-xl">House rules</h2>
              {!isHost && <span className="ml-auto text-xs text-white/50">Host decides</span>}
            </div>
            <ul className="space-y-2.5">
              {RULES.map((r) => (
                <li key={r.key} className="flex items-start gap-3">
                  <span className="text-2xl">{r.icon}</span>
                  <div className="flex-1">
                    <div className="font-bold">{r.title}</div>
                    <div className="text-xs text-white/60 leading-snug">{r.desc}</div>
                  </div>
                  <Toggle on={room.rules[r.key]} disabled={!isHost} onChange={(v) => actions.setRules({ [r.key]: v })} />
                </li>
              ))}
            </ul>
            <div className="border-t border-white/10 mt-4 pt-3 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏱️</span>
                <div className="flex-1"><div className="font-bold">Turn timer</div><div className="text-xs text-white/60">Autopilot plays when time runs out</div></div>
                <select disabled={!isHost} value={room.settings.turnSeconds} onChange={(e) => actions.setRules({}, { turnSeconds: Number(e.target.value) })}
                  className="bg-white/10 rounded-lg text-sm px-2 py-1 outline-none">
                  {[15, 30, 60, 0].map((s) => <option key={s} value={s} className="text-black">{s ? `${s}s` : 'Off'}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">👀</span>
                <div className="flex-1"><div className="font-bold">Spectators see hands</div><div className="text-xs text-white/60">Great for streaming & teaching</div></div>
                <Toggle on={room.settings.spectatorsSeeHands} disabled={!isHost} onChange={(v) => actions.setRules({}, { spectatorsSeeHands: v })} />
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-center">
          {isHost ? (
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={actions.start} disabled={room.seats.length < 2}
              className="btn-gold text-xl !px-10 !py-4">
              {room.seats.length < 2 ? 'Add a bot or invite a friend' : `Deal ${room.seats.length} players 🃏`}
            </motion.button>
          ) : (
            <div className="glass rounded-2xl px-5 py-3 text-white/80">Waiting for the host to deal…</div>
          )}
        </div>
      </div>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
