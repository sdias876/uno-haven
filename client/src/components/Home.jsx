import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useGame } from '../lib/store.jsx';
import { prefs } from '../lib/socket.js';
import { useInstall } from '../lib/install.js';
import { Card } from './Card.jsx';
import { Tutorial } from './Tutorial.jsx';

const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🦉', '🐙', '🦄', '🐨', '🐵', '🐧', '🦁', '🐳'];
const MODES = [
  { key: 'smart', label: 'Auto', icon: '✨', bots: ['smart', 'smart', 'smart'], desc: 'Adapts to you' },
  { key: 'casual', label: 'Chill', icon: '😊', bots: ['casual', 'casual', 'casual'], desc: 'Relaxed' },
  { key: 'tactical', label: 'Classic', icon: '🧠', bots: ['tactical', 'tactical', 'casual'], desc: 'Smart mix' },
  { key: 'ruthless', label: 'Ruthless', icon: '😈', bots: ['ruthless', 'ruthless', 'tactical'], desc: 'No mercy' },
];

const heroCards = [
  { id: 'h1', color: 'red', value: '7' }, { id: 'h2', color: 'yellow', value: 'skip' },
  { id: 'h3', color: 'wild', value: 'wild4' }, { id: 'h4', color: 'green', value: 'reverse' }, { id: 'h5', color: 'blue', value: 'draw2' },
];

const skillLabel = (s) => (s < 0.3 ? 'gentle' : s < 0.55 ? 'balanced' : s < 0.8 ? 'sharp' : 'fierce');

export function Home() {
  const { profile, setProfile, actions, connected, offline } = useGame();
  const params = new URLSearchParams(window.location.search);
  const [code, setCode] = useState(params.get('room')?.toUpperCase() ?? '');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(() => (MODES.some((m) => m.key === prefs.get('mode')) ? prefs.get('mode') : 'smart'));
  const [showModes, setShowModes] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [tutorial, setTutorial] = useState(() => !prefs.get('tutorialDone', false) && !params.get('room'));
  const install = useInstall();
  const name = profile.name;
  const skill = prefs.get('skill', 0.45);
  const current = MODES.find((m) => m.key === mode);
  const canOnline = connected && !offline;

  const pickMode = (k) => { setMode(k); prefs.set('mode', k); setShowModes(false); };
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
        <p className="text-center text-white/65 mt-1 mb-5">Tap a card. Match the color or number. Win.</p>

        <div className="glass rounded-3xl p-5 space-y-4">
          <div>
            <label htmlFor="name" className="text-xs uppercase tracking-wider text-white/50 font-bold">Your name</label>
            <div className="flex gap-2 mt-1">
              <button onClick={() => setProfile({ ...profile, avatar: AVATARS[(AVATARS.indexOf(profile.avatar) + 1) % AVATARS.length] })}
                className="text-3xl w-14 shrink-0 rounded-xl bg-white/10 hover:bg-white/15" title="Tap to change your avatar" aria-label="Change avatar">{profile.avatar}</button>
              <input id="name" value={name} maxLength={20} autoComplete="nickname"
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="e.g. Savio"
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-lg outline-none focus:ring-2 ring-gold/60 select-text" />
            </div>
          </div>

          {code ? (
            <div className="space-y-2">
              <div className="text-sm text-white/70">You’ve been invited to table <b className="font-mono text-gold">{code}</b></div>
              <button disabled={busy || !canOnline} onClick={() => run(() => actions.joinRoom(code))} className="btn-gold w-full text-lg !py-3.5">
                {canOnline ? 'Join table 🃏' : offline ? 'You’re offline' : 'Connecting…'}
              </button>
              <button onClick={() => setCode('')} className="btn-ghost w-full text-sm">Play solo instead</button>
            </div>
          ) : (
            <>
              <div>
                <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={() => quick()} className="btn-gold w-full text-xl !py-4">
                  Play now ▶
                </motion.button>
                <button onClick={() => setShowModes((o) => !o)} className="w-full mt-2 text-sm text-white/60 hover:text-white">
                  vs 3 bots · {current.icon} {current.label}{mode === 'smart' ? ` (${skillLabel(skill)} right now)` : ''} ▾
                </button>
                <AnimatePresence>
                  {showModes && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="grid grid-cols-4 gap-1.5 pt-2">
                        {MODES.map((m) => (
                          <button key={m.key} onClick={() => pickMode(m.key)}
                            className={`rounded-2xl p-2 text-center transition ${mode === m.key ? 'bg-gold/25 ring-2 ring-gold' : 'bg-white/5 hover:bg-white/10'}`}>
                            <div className="text-xl">{m.icon}</div>
                            <div className="font-display text-sm">{m.label}</div>
                            <div className="text-[10px] text-white/55 leading-tight">{m.desc}</div>
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-white/45 mt-2 text-center">Auto bots get tougher when you win and ease off when you lose.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="border-t border-white/10 pt-3">
                {!showFriends ? (
                  <button onClick={() => setShowFriends(true)} className="btn-ghost w-full">👥 Play with friends</button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button disabled={busy || !canOnline} onClick={() => run(actions.createRoom)} className="btn-ghost">New table</button>
                    <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); const v = e.currentTarget.code.value; if (v) run(() => actions.joinRoom(v)); }}>
                      <input name="code" placeholder="CODE" maxLength={5} aria-label="Table code"
                        className="w-full min-w-0 rounded-2xl bg-white/10 px-3 font-mono tracking-widest uppercase outline-none focus:ring-2 ring-gold/60 select-text" />
                      <button className="btn-ghost !px-3" disabled={busy || !canOnline}>Join</button>
                    </form>
                    {!canOnline && (
                      <p className="col-span-2 text-xs text-amber-300 text-center">
                        {offline ? 'Friends need internet — solo play works offline.' : 'Waking up the game server… (can take up to a minute)'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex items-center justify-center gap-4 text-sm text-white/60">
            <button onClick={() => setTutorial(true)} className="hover:text-white">🎓 How to play</button>
            {install.canInstall && <button onClick={install.install} className="hover:text-white">📲 Install app</button>}
          </div>
          {install.iosHint && (
            <p className="text-[11px] text-center text-white/45">📲 To install on iPhone/iPad: tap Share, then “Add to Home Screen”.</p>
          )}
        </div>
      </div>
      {tutorial && (
        <Tutorial
          onSkip={() => { setTutorial(false); prefs.set('tutorialDone', true); }}
          onDone={() => { setTutorial(false); prefs.set('tutorialDone', true); if (name.trim()) quick('smart'); else document.getElementById('name')?.focus(); }}
        />
      )}
    </div>
  );
}
