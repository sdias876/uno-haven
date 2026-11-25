import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from './Avatar.jsx';
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../lib/store.jsx';

export const EMOTES = ['👍', '😂', '😱', '🔥', '😈', '🙏', '👏', '😭', '🎉', '💀'];

export function EmoteBar({ compact }) {
  const { actions } = useGame();
  return (
    <div className={`glass rounded-2xl flex ${compact ? 'gap-0.5 p-1' : 'gap-1 p-1.5'} overflow-x-auto`}>
      {EMOTES.map((e) => (
        <motion.button key={e} whileTap={{ scale: 1.4 }} whileHover={{ y: -3 }}
          onClick={() => actions.emote(e)} className={`${compact ? 'text-lg w-8 h-8' : 'text-xl w-9 h-9'} rounded-xl hover:bg-white/10`}
          aria-label={`React ${e}`}>{e}</motion.button>
      ))}
    </div>
  );
}

/** Floating emotes rising from the sender's seat (or bottom center for spectators). */
export function EmoteLayer({ seatPositions }) {
  const { emotes } = useGame();
  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <AnimatePresence>
        {emotes.map((e) => {
          const pos = seatPositions?.[e.fromId] ?? { x: '50%', y: '70%' };
          return (
            <motion.div key={e.key} className="absolute text-4xl"
              style={{ left: pos.x, top: pos.y }}
              initial={{ y: 0, scale: 0.3, opacity: 0 }}
              animate={{ y: -120, scale: [0.3, 1.5, 1.1], opacity: [0, 1, 1, 0], rotate: [0, -12, 10, 0] }}
              transition={{ duration: 2.2, ease: 'easeOut' }}>
              {e.emoji}
              {e.from && <span className="block text-[10px] text-center font-bold text-white/80 -mt-1">{e.from.replace(' 🤖', '')}</span>}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function ChatPanel({ open, onClose }) {
  const { chat, actions } = useGame();
  const [text, setText] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [chat, open]);
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const r = await actions.chat(text);
    if (!r.error) setText('');
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.aside className="glass fixed right-2 top-16 bottom-2 z-40 w-[min(320px,calc(100vw-16px))] rounded-3xl flex flex-col"
          initial={{ x: 340, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 340, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="font-display text-lg">Table chat</span>
            <button onClick={onClose} className="btn-ghost !px-3 !py-1">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2 space-y-1.5 select-text">
            {chat.map((m) => m.system ? (
              <div key={m.id} className="text-xs text-center text-white/50 py-0.5">{m.text}</div>
            ) : (
              <div key={m.id} className="text-sm">
                <Avatar k={m.avatar} size={20} className="inline-block align-middle mr-1" />
                <span className={`font-bold ${m.spectator ? 'text-white/60' : 'text-gold'}`}>{m.from}{m.spectator ? ' (watching)' : ''}:</span>{' '}
                <span className="text-white/90 break-words">{m.text}</span>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="px-3 pb-2"><EmoteBar compact /></div>
          <form onSubmit={submit} className="flex gap-2 p-3 pt-0">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Say something nice…"
              className="flex-1 rounded-xl bg-white/10 px-3 py-2 outline-none focus:ring-2 ring-gold/60 select-text" />
            <button className="btn-gold !px-3">Send</button>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export function Toasts() {
  const { toasts } = useGame();
  const tone = { good: 'bg-emerald-600/90', bad: 'bg-rose-600/90', info: 'bg-slate-800/90' };
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ y: -20, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className={`${tone[t.tone] ?? tone.info} rounded-2xl px-4 py-2 text-sm font-bold shadow-xl backdrop-blur`}>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Banners() {
  const { banners } = useGame();
  const colors = { gold: '#f5c451', red: '#ff5252', blue: '#42a5f5', green: '#66bb6a', yellow: '#ffd54f' };
  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
      <AnimatePresence>
        {banners.map((b) => (
          <motion.div key={b.id} className="absolute font-display font-bold text-5xl sm:text-7xl text-center px-4"
            style={{ color: colors[b.color], WebkitTextStroke: '2px #111', textShadow: '0 6px 0 #111, 0 0 40px rgba(0,0,0,.6)' }}
            initial={{ scale: 0.2, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: -4 }} exit={{ scale: 1.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
            {b.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
