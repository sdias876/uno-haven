import { motion } from 'framer-motion';

const TILES = [
  { ch: 'U', bg: 'linear-gradient(160deg,#ff5a5d,#c9262a)', rot: -10 },
  { ch: 'N', bg: 'linear-gradient(160deg,#ffd96e,#d9a21c)', rot: 3 },
  { ch: 'O', bg: 'linear-gradient(160deg,#47d18d,#1c8f5b)', rot: 12 },
];

/** Wordmark: three mini card tiles + "Haven" in brass. `size` = tile height in px. */
export function Logo({ size = 40, animate = false, className = '' }) {
  const tileW = size * 0.74;
  return (
    <div className={`inline-flex items-center ${className}`} aria-label="UNO Haven" role="img">
      <div className="flex" style={{ gap: size * 0.04 }}>
        {TILES.map((t, i) => (
          <motion.span key={t.ch}
            initial={animate ? { y: -size, rotate: t.rot - 40, opacity: 0 } : false}
            animate={{ y: 0, rotate: t.rot, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.09, type: 'spring', stiffness: 320, damping: 16 }}
            className="relative grid place-items-center font-display text-white"
            style={{
              width: tileW, height: size, background: t.bg, borderRadius: size * 0.16,
              border: `${Math.max(2, size * 0.06)}px solid #fff`,
              boxShadow: `0 ${size * 0.06}px 0 rgba(0,0,0,.25), 0 ${size * 0.15}px ${size * 0.3}px rgba(0,0,0,.35)`,
              fontSize: size * 0.62, WebkitTextStroke: `${size * 0.03}px #151a36`, paintOrder: 'stroke fill',
              textShadow: `0 ${size * 0.04}px 0 #151a36`,
            }}>
            {t.ch}
          </motion.span>
        ))}
      </div>
      <span className="font-display ml-[0.35em] leading-none"
        style={{
          fontSize: size * 0.78,
          background: 'linear-gradient(180deg,#f6e2b0 0%,#d9b26a 55%,#a77d3a 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          filter: 'drop-shadow(0 2px 0 rgba(0,0,0,.45))',
        }}>
        Haven
      </span>
    </div>
  );
}
