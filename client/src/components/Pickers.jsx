import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from './Avatar.jsx';
import { COLOR_HEX } from './Card.jsx';

function Sheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="glass rounded-t-3xl sm:rounded-3xl p-5 w-full sm:w-auto sm:min-w-[340px]"
            initial={{ y: 80, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-center mb-4">{title}</h3>
            {children}
            <button className="btn-ghost w-full mt-4" onClick={onClose}>Cancel</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ColorPicker({ open, onPick, onClose, suggested }) {
  return (
    <Sheet open={open} onClose={onClose} title="Pick a color">
      <div className="grid grid-cols-2 gap-3">
        {['red', 'yellow', 'green', 'blue'].map((c, i) => (
          <motion.button key={c} onClick={() => onPick(c)}
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: { delay: i * 0.04 } }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
            className="relative h-24 rounded-2xl font-display text-lg font-bold capitalize text-white shadow-lg"
            style={{ background: COLOR_HEX[c], textShadow: '0 2px 0 rgba(0,0,0,.35)' }}>
            {c}
            {suggested === c && <span className="absolute top-1.5 right-2 chip bg-black/40">💡 coach pick</span>}
          </motion.button>
        ))}
      </div>
    </Sheet>
  );
}

export function SwapPicker({ open, players, onPick, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="7 played — swap hands with…">
      <div className="flex flex-col gap-2">
        {players.map((p) => (
          <button key={p.id} onClick={() => onPick(p.id)} className="btn-ghost justify-between !py-3">
            <span className="flex items-center gap-2"><Avatar k={p.avatar} size={30} />{p.name}</span>
            <span className="chip bg-white/15">{p.cardCount} cards</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
