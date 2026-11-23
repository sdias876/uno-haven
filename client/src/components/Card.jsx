import { motion } from 'framer-motion';

export const COLOR_HEX = { red: '#e53935', yellow: '#fbc02d', green: '#43a047', blue: '#1e88e5', wild: '#151515' };
const SIZES = {
  xs: { w: 34, h: 50, f: 6 },
  sm: { w: 52, h: 76, f: 8 },
  md: { w: 74, h: 108, f: 11 },
  lg: { w: 92, h: 134, f: 13.5 },
};

function Symbol({ value, color }) {
  const fill = COLOR_HEX[color] ?? '#111';
  switch (value) {
    case 'skip':
      return (
        <svg viewBox="0 0 40 40" className="w-[2.6em] h-[2.6em]"><circle cx="20" cy="20" r="14" fill="none" stroke={fill} strokeWidth="5.5" /><line x1="10" y1="30" x2="30" y2="10" stroke={fill} strokeWidth="5.5" strokeLinecap="round" /></svg>
      );
    case 'reverse':
      return (
        <svg viewBox="0 0 40 40" className="w-[2.6em] h-[2.6em]">
          <path d="M8 24 L20 12 L20 18 L30 18 L30 24 Z" fill={fill} transform="rotate(-30 20 20)" />
          <path d="M32 16 L20 28 L20 22 L10 22 L10 16 Z" fill={fill} transform="rotate(-30 20 20)" />
        </svg>
      );
    case 'draw2':
      return <span className="text-[2.1em] font-bold leading-none" style={{ color: fill, WebkitTextStroke: '0.04em #111' }}>+2</span>;
    case 'wild4':
      return <span className="text-[2.1em] font-bold leading-none text-white" style={{ WebkitTextStroke: '0.05em #111' }}>+4</span>;
    case 'wild':
      return <WildWheel />;
    default:
      return (
        <span className="text-[3em] font-bold leading-none" style={{ color: fill, WebkitTextStroke: '0.035em #111', textShadow: '0.05em 0.05em 0 rgba(0,0,0,.25)' }}>
          {value}
        </span>
      );
  }
}

function WildWheel() {
  return (
    <svg viewBox="0 0 40 40" className="w-[3em] h-[3em]">
      <g transform="rotate(28 20 20)">
        <path d="M20 20 L20 2 A12 18 0 0 1 32 20 Z" fill={COLOR_HEX.red} />
        <path d="M20 20 L32 20 A12 18 0 0 1 20 38 Z" fill={COLOR_HEX.green} />
        <path d="M20 20 L20 38 A12 18 0 0 1 8 20 Z" fill={COLOR_HEX.yellow} />
        <path d="M20 20 L8 20 A12 18 0 0 1 20 2 Z" fill={COLOR_HEX.blue} />
      </g>
    </svg>
  );
}

const corner = (v) => ({ skip: '⊘', reverse: '⇄', draw2: '+2', wild: 'W', wild4: '+4' }[v] ?? v);

/**
 * Presentational card. `faceDown` shows the back. `chosenColor` tints a played wild.
 */
export function Card({ card, size = 'md', faceDown = false, chosenColor, className = '', style, ...motionProps }) {
  const s = SIZES[size];
  const dims = { width: s.w, height: s.h, fontSize: s.f };
  if (faceDown || !card) {
    return (
      <motion.div {...motionProps} className={`uno-card card-back shrink-0 ${className}`} style={{ ...dims, ...style }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display font-bold text-[2.2em] text-gold -rotate-[18deg]" style={{ WebkitTextStroke: '0.04em #111', textShadow: '0.06em 0.06em 0 #111' }}>UNO</span>
        </div>
      </motion.div>
    );
  }
  const isWild = card.color === 'wild';
  const bg = isWild ? '#151515' : COLOR_HEX[card.color];
  return (
    <motion.div
      {...motionProps}
      className={`uno-card shrink-0 ${className}`}
      style={{ ...dims, background: bg, ...style }}
      aria-label={`${card.color} ${card.value}`}
    >
      <div className="oval" style={isWild ? { background: '#151515', boxShadow: 'inset 0 0 0 0.25em #fff' } : undefined} />
      <div className="absolute inset-0 flex items-center justify-center">
        <Symbol value={card.value} color={card.color} />
      </div>
      <span className="absolute top-[4%] left-[8%] text-[1.15em] font-bold text-white leading-none" style={{ WebkitTextStroke: '0.03em #111' }}>{corner(card.value)}</span>
      <span className="absolute bottom-[4%] right-[8%] text-[1.15em] font-bold text-white leading-none rotate-180" style={{ WebkitTextStroke: '0.03em #111' }}>{corner(card.value)}</span>
      {isWild && chosenColor && (
        <span className="absolute bottom-[8%] left-1/2 -translate-x-1/2 w-[1.6em] h-[1.6em] rounded-full border-2 border-white" style={{ background: COLOR_HEX[chosenColor] }} />
      )}
    </motion.div>
  );
}

export const cardName = (c) => {
  const names = { skip: 'Skip', reverse: 'Reverse', draw2: 'Draw Two', wild: 'Wild', wild4: 'Wild Draw Four' };
  const v = names[c.value] ?? c.value;
  return c.color === 'wild' ? v : `${c.color[0].toUpperCase()}${c.color.slice(1)} ${v}`;
};
