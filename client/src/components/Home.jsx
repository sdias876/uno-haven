import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useGame } from '../lib/store.jsx';
import { prefs } from '../lib/socket.js';
import { Card } from './Card.jsx';
import { Tutorial } from './Tutorial.jsx';

const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🦉', '🐙', '🦄', '🐨', '🐵', '🐧', '🦁', '🐳'];
const MODES = [
  { key: 'casual', label: 'Chill', icon: '😊', bots: ['casual', 'casual', 'casual'], desc: '3 relaxed bots' },
  { key: 'tactical', label: 'Classic', icon: '🧠', bots: ['tactical', 'tactical', 'casual'], desc: 'Mixed smart table' },
  { key: 'ruthless', label: 'Ruthless', icon: '😈', bots: ['ruthless', 'ruthless', 'tactical'], desc: 'No mercy' },
];

const heroCards = [
  { id: 'h1', color: 'red', value: '7' }, { id: 'h2', color: 'yellow', value: 'skip' },
  { id: 'h3', color: 'wild', value: 'wild4' }, { id: 'h4', color: 'green', value: 'reverse' }, { id: 'h5', color: 'blue', value: 'draw2' },
];

export function Home() {
  const { profile, setProfile, actions, connected } = useGame();
  const params = new URLSearchParams(window.location.search);
  const [code, setCode] = useState(params.get('room')?.toUpperCase() ?? '');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(() => prefs.get('mode', 'tactical'));
  const [tutorial, setTutorial] = useState(() => !prefs.get('tutorialDone', false) && !params.get('room'));
  const name = profile.name;

  useEffect(() => { prefs.set('mode', mode); }, [mode]);

  const run = async (fn) => {
    if (!name.trim()) { document.getElementById('name')?.focus(); return; }
    setBusy(true);
    await fn();
    setBusy(false);
  };
  const quick = (m = mode) => run(() => actions.quickPlay(MODES.find((x) => x.key === m).bots));

  return (
    <div className="felt min-h-full overflow-y-auto flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="relative h-40 mb-2">
          {heroCards.map((c, i) => (
            <motion.div key={c.id} className="absolute left-1/2 top-4"
              initial={{ y: 80, opacity: 0, rotate: 0, x: '-50%' }}
              animate={{ y: Math.abs(i - 2) * 8, opacity: 1, rotate: (i - 2) * 14, x: `calc(-50% + ${(i - 2) * 46}px)` }}
              transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 200, damping: 16 }}
              whileHover={{ y: -16 }}>
              <Card card={c} size="md" />
            </motion.div>
          ))}
        </div>
        <h1 className="font-display text-5xl text-center font-bold tracking-wide">
          <span className="text-uno-red">U</span><span className="text-uno-yellow">N</span><span className="text-uno-green">O</span>
          <span className="text-white"> Haven</span>
        </h1>
        <p className="text-center text-white/65 mt-1 mb-5">Smart bots · a coach in your corner · play with friends</p>

        <div className="glass rounded-3xl p-5 space-y-4">
          <div>
            <label htmlFor="name" className="text-xs uppercase tracking-wider text-white/50 font-bold">Your name</label>
            <input id="name" value={name} maxLength={20} autoComplete="nickname"
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="e.g. Savio"
              className="w-full mt-1 rounded-xl bg-white/10 px-4 py-3 text-lg outline-none focus:ring-2 ring-gold/60 select-text" />
            <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
              {AVATARS.map((a) => (
                <button key={a} onClick={() => setProfile({ ...profile, avatar: a })}
                  className={`text-2xl w-10 h-10 shrink-0 rounded-xl ${profile.avatar === a ? 'bg-gold/30 ring-2 ring-gold' : 'hover:bg-white/10'}`}>{a}</button>
              ))}
            </div>
          </div>

          {code ? (
            <div className="space-y-2">
              <div className="text-sm text-white/70">You’ve been invited to table <b className="font-mono text-gold">{code}</b></div>
              <button disabled={busy || !connected} onClick={() => run(() => actions.joinRoom(code))} className="btn-gold w-full text-lg !py-3.5">Join table 🃏</button>
              <button onClick={() => setCode('')} className="btn-ghost w-full text-sm">Play something else</button>
            </div>
          ) : (
            <>
              <div>
                <div className="text-xs uppercase tracking-wider text-white/50 font-bold mb-1.5">Quick play vs bots</div>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map((m) => (
                    <button key={m.key} onClick={() => setMode(m.key)}
                      className={`rounded-2xl p-2.5 text-center transition ${mode === m.key ? 'bg-gold/25 ring-2 ring-gold' : 'bg-white/5 hover:bg-white/10'}`}>
                      <div className="text-2xl">{m.icon}</div>
                      <div className="font-display">{m.label}</div>
                      <div className="text-[11px] text-white/55">{m.desc}</div>
                    </button>
                  ))}
                </div>
                <button disabled={busy || !connected} onClick={() => quick()} className="btn-gold w-full text-lg mt-3 !py-3.5">Play now ▶</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={busy || !connected} onClick={() => run(actions.createRoom)} className="btn-ghost">👥 Private table</button>
                <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); const v = e.currentTarget.code.value; if (v) run(() => actions.joinRoom(v)); }}>
                  <input name="code" placeholder="CODE" maxLength={5}
                    className="w-full min-w-0 rounded-2xl bg-white/10 px-3 font-mono tracking-widest uppercase outline-none focus:ring-2 ring-gold/60 select-text" />
                  <button className="btn-ghost !px-3" disabled={busy || !connected}>Join</button>
                </form>
              </div>
            </>
          )}
          <button onClick={() => setTutorial(true)} className="w-full text-sm text-white/60 hover:text-white">🎓 45-second tutorial</button>
          {!connected && <div className="text-center text-xs text-amber-300">Connecting to the game server…</div>}
        </div>
      </div>
      {tutorial && (
        <Tutorial
          onSkip={() => { setTutorial(false); prefs.set('tutorialDone', true); }}
          onDone={() => { setTutorial(false); prefs.set('tutorialDone', true); setMode('casual'); if (name.trim()) quick('casual'); else document.getElementById('name')?.focus(); }}
        />
      )}
    </div>
  );
}
