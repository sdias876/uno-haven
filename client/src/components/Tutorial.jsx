import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Card } from './Card.jsx';
import { play, say } from '../lib/sound.js';

const C = (id, color, value) => ({ id, color, value });

const STEPS = [
  {
    title: 'Match the color or the number',
    body: 'The glowing cards are legal. Dim ones can’t be played right now. Tap a glowing card!',
    top: C('t1', 'red', '5'),
    hand: [C('a', 'blue', '5'), C('b', 'red', '2'), C('c', 'green', '8')],
    playable: ['a', 'b'],
    success: (card) => (card.color === 'red' ? 'Same color — red on red. 🎯' : 'Same number — 5 on 5. 🎯'),
  },
  {
    title: 'Action cards change the game',
    body: 'Viper 🤖 has only 2 cards left! Play your Skip to block their turn.',
    top: C('t2', 'yellow', '3'),
    hand: [C('d', 'yellow', 'skip'), C('e', 'blue', '9')],
    playable: ['d'],
    opponent: { name: 'Viper 🤖', cards: 2 },
    success: () => 'Blocked! Skip, Reverse, +2 and Wilds are your weapons. ⊘',
  },
  {
    title: 'Down to one? Hit UNO!',
    body: 'Playing this card leaves you with one. Tap the red UNO button first (or say “UNO!” with voice on), then play.',
    top: C('t3', 'green', '1'),
    hand: [C('f', 'green', '4'), C('g', 'green', '7')],
    playable: ['f', 'g'],
    needsUno: true,
    success: () => 'Perfect! Forget to call it and anyone can Catch you for +2. 🚨',
  },
];

export function Tutorial({ onDone, onSkip }) {
  const [step, setStep] = useState(0);
  const [played, setPlayed] = useState(null);
  const [uno, setUno] = useState(false);
  const [nudge, setNudge] = useState(null);
  const s = STEPS[step];
  const done = step >= STEPS.length;

  const tap = (card) => {
    if (played) return;
    if (!s.playable.includes(card.id)) { setNudge('That one doesn’t match — look for the glow.'); play('error'); return; }
    if (s.needsUno && !uno) { setNudge('Hit UNO first — or you’ll get caught!'); play('caught'); return; }
    play(card.value === 'skip' ? 'skip' : 'snap');
    setPlayed(card);
    setNudge(null);
  };
  const next = () => { setStep((x) => x + 1); setPlayed(null); setUno(false); setNudge(null); };

  return (
    <motion.div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="glass !bg-felt-800/95 rounded-3xl w-full max-w-lg p-5 sm:p-6 relative" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
        <button onClick={onSkip} className="absolute right-4 top-4 text-white/50 hover:text-white text-sm">Skip ✕</button>
        <div className="flex gap-1.5 mb-4">
          {STEPS.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step || (i === step && played) ? 'bg-gold' : i === step ? 'bg-white/40' : 'bg-white/15'}`} />)}
        </div>

        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div key={step} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }}>
              <div className="text-sm text-gold">Step {step + 1} of 3</div>
              <h2 className="font-display text-2xl mt-0.5">{s.title}</h2>
              <p className="text-white/75 text-sm mt-1 min-h-[40px]">{s.body}</p>

              <div className="relative rounded-2xl bg-felt-700/80 mt-4 p-4 flex flex-col items-center gap-4 min-h-[260px]">
                {s.opponent && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-2xl">🤖</span><b>{s.opponent.name}</b>
                    <motion.span animate={played ? { scale: [1, 1.3, 1] } : {}} className={`chip ${played ? 'bg-sky-500' : 'bg-uno-red'}`}>
                      {played ? 'SKIPPED' : `${s.opponent.cards} cards`}
                    </motion.span>
                  </div>
                )}
                <div className="relative w-[74px] h-[108px]">
                  <Card card={s.top} size="md" className="absolute" />
                  <AnimatePresence>
                    {played && (
                      <motion.div className="absolute inset-0" initial={{ y: 180, rotate: -40, scale: 1.2 }} animate={{ y: 0, rotate: 8, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                        <Card card={played} size="md" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex gap-2 items-end">
                  {s.hand.filter((c) => c.id !== played?.id).map((c) => {
                    const ok = s.playable.includes(c.id);
                    return (
                      <motion.button key={c.id} onClick={() => tap(c)} animate={{ y: ok && !played ? -12 : 0 }} whileHover={ok ? { y: -20 } : {}}>
                        <Card card={c} size="md" style={{
                          filter: ok ? 'none' : 'brightness(.55) saturate(.6)',
                          boxShadow: ok && !played ? '0 0 0 3px rgba(255,255,255,.85), 0 0 22px 4px rgba(120,230,255,.55)' : undefined,
                        }} />
                      </motion.button>
                    );
                  })}
                </div>
                {s.needsUno && !played && (
                  <motion.button onClick={() => { setUno(true); play('uno'); say('UNO!'); setNudge(null); }}
                    animate={uno ? { scale: 1 } : { scale: [1, 1.1, 1] }} transition={{ repeat: uno ? 0 : Infinity, duration: 0.8 }}
                    className={`absolute right-3 bottom-3 w-20 h-20 rounded-full font-display text-2xl font-bold text-white ${uno ? 'bg-emerald-600' : 'bg-uno-red pulse-ring'}`}>
                    {uno ? '✓' : 'UNO!'}
                  </motion.button>
                )}
              </div>

              <div className="min-h-[52px] mt-3">
                {nudge && <motion.div initial={{ x: -6 }} animate={{ x: [6, -6, 4, 0] }} className="text-rose-300 text-sm font-bold">{nudge}</motion.div>}
                {played && (
                  <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-3">
                    <span className="text-emerald-300 font-bold text-sm flex-1">{s.success(played)}</span>
                    <button onClick={next} className="btn-gold">{step === STEPS.length - 1 ? 'Finish' : 'Next →'}</button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-4">
              <div className="text-6xl">🎉</div>
              <h2 className="font-display text-3xl mt-2">You’re ready!</h2>
              <p className="text-white/70 mt-2 text-sm">Stuck mid-game? Tap <b>💡 Smart Hint</b> and the Coach will point at the best card and tell you why.</p>
              <button onClick={onDone} className="btn-gold text-lg mt-5 !px-8">Play vs friendly bots</button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
