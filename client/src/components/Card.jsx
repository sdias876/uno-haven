import { motion } from 'framer-motion';

// Rich, slightly deepened card colors (top-light → bottom-dark gradient per color)
export const COLOR_HEX = { red: '#e5383b', yellow: '#f7c548', green: '#2bb673', blue: '#2d7ff9', wild: '#14172b' };
const GRADIENT = {
  red: 'linear-gradient(160deg, #ff5a5d 0%, #e5383b 45%, #b3191c 100%)',
  yellow: 'linear-gradient(160deg, #ffd96e 0%, #f7c548 45%, #d49a17 100%)',
  green: 'linear-gradient(160deg, #47d18d 0%, #2bb673 45%, #168553 100%)',
  blue: 'linear-gradient(160deg, #5a9bff 0%, #2d7ff9 45%, #1652b8 100%)',
  wild: 'linear-gradient(160deg, #262b4d 0%, #14172b 50%, #07080f 100%)',
};
const INK = '#151a36';
const SIZES = {
  xs: { w: 34, h: 50, f: 5 },
  sm: { w: 52, h: 76, f: 7.7 },
  md: { w: 74, h: 108, f: 11 },
  lg: { w: 92, h: 134, f: 13.5 },
};

const numeralStyle = (fill) => ({
  color: fill,
  WebkitTextStroke: `0.045em ${INK}`,
  paintOrder: 'stroke fill',
  textShadow: `0.06em 0.07em 0 ${INK}`,
  display: 'inline-block',
  transform: 'skewX(-7deg)',
});

function Symbol({ value, color }) {
  const fill = COLOR_HEX[color] ?? INK;
  switch (value) {
    case 'skip':
      return (
        <svg viewBox="0 0 40 40" className="w-[2.7em] h-[2.7em] drop-shadow-[0.05em_0.07em_0_rgba(21,26,54,1)]">
          <circle cx="20" cy="20" r="13" fill="none" stroke={INK} strokeWidth="9" />
          <circle cx="20" cy="20" r="13" fill="none" stroke={fill} strokeWidth="5.5" />
          <line x1="11" y1="29" x2="29" y2="11" stroke={INK} strokeWidth="9" strokeLinecap="round" />
          <line x1="11" y1="29" x2="29" y2="11" stroke={fill} strokeWidth="5.5" strokeLinecap="round" />
        </svg>
      );
    case 'reverse':
      return (
        <svg viewBox="0 0 40 40" className="w-[2.9em] h-[2.9em] drop-shadow-[0.05em_0.07em_0_rgba(21,26,54,1)]">
          <g transform="rotate(-30 20 20)" stroke={INK} strokeWidth="2" strokeLinejoin="round">
            <path d="M5 13 L15 4 L15 10 L33 10 L33 16 L15 16 L15 22 Z" fill={fill} />
            <path d="M35 27 L25 36 L25 30 L7 30 L7 24 L25 24 L25 18 Z" fill={fill} />
          </g>
        </svg>
      );
    case 'draw2':
      return <span className="text-[2.5em] leading-none" style={numeralStyle(fill)}>+2</span>;
    case 'wild4':
      return <span className="text-[2.5em] leading-none" style={numeralStyle('#ffffff')}>+4</span>;
    case 'wild':
      return null;
    default:
      return (
        <span className="text-[3.4em] leading-none" style={{ ...numeralStyle(fill), textDecoration: value === '6' || value === '9' ? 'underline' : 'none', textDecorationThickness: '0.06em', textUnderlineOffset: '0.06em' }}>
          {value}
        </span>
      );
  }
}

const corner = (v) => ({ skip: '⊘', reverse: '⇄', draw2: '+2', wild: 'W', wild4: '+4' }[v] ?? v);
const WILD_OVAL = `conic-gradient(from 0deg, ${COLOR_HEX.red} 0 25%, ${COLOR_HEX.blue} 25% 50%, ${COLOR_HEX.yellow} 50% 75%, ${COLOR_HEX.green} 75% 100%)`;

/**
 * Presentational card. `faceDown` shows the back. `chosenColor` tints a played wild.
 * size: a preset name ('xs'…'lg') or a number = card width in px.
 */
export function Card({ card, size = 'md', faceDown = false, chosenColor, className = '', style, ...motionProps }) {
  const s = typeof size === 'number' ? { w: size, h: Math.round(size * 1.46), f: size * 0.148 } : SIZES[size];
  const dims = { width: s.w, height: s.h, fontSize: s.f };
  if (faceDown || !card) {
    return (
      <motion.div {...motionProps} className={`uno-card card-back shrink-0 ${className}`} style={{ ...dims, ...style }}>
        <div className="frame" style={{ borderColor: 'rgba(217,178,106,.45)' }} />
        <div className="back-oval" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[2.3em] -rotate-[22deg]" style={{ ...numeralStyle('#f7c548'), transform: 'rotate(-22deg) skewX(-7deg)' }}>UNO</span>
        </div>
      </motion.div>
    );
  }
  const isWild = card.color === 'wild';
  const label = corner(card.value);
  return (
    <motion.div
      {...motionProps}
      className={`uno-card shrink-0 ${className}`}
      style={{ ...dims, background: GRADIENT[card.color], ...style }}
      aria-label={`${card.color} ${card.value}`}
    >
      <div className="frame" />
      <div className="oval" style={isWild ? { background: WILD_OVAL, boxShadow: `0 0 0 0.22em #fff, 0 0.1em 0.4em rgba(0,0,0,.5)` } : undefined} />
      <div className="absolute inset-0 flex items-center justify-center">
        <Symbol value={card.value} color={card.color} />
      </div>
      <span className="absolute top-[5%] left-[9%] text-[1.25em] leading-none text-white" style={{ WebkitTextStroke: `0.05em ${INK}`, paintOrder: 'stroke fill' }}>{label}</span>
      <span className="absolute bottom-[5%] right-[9%] text-[1.25em] leading-none text-white rotate-180" style={{ WebkitTextStroke: `0.05em ${INK}`, paintOrder: 'stroke fill' }}>{label}</span>
      {isWild && chosenColor && (
        <span className="absolute bottom-[9%] left-1/2 -translate-x-1/2 w-[1.7em] h-[1.7em] rounded-full border-[0.2em] border-white shadow" style={{ background: COLOR_HEX[chosenColor] }} />
      )}
    </motion.div>
  );
}

export const cardName = (c) => {
  const names = { skip: 'Skip', reverse: 'Reverse', draw2: 'Draw Two', wild: 'Wild', wild4: 'Wild Draw Four' };
  const v = names[c.value] ?? c.value;
  return c.color === 'wild' ? v : `${c.color[0].toUpperCase()}${c.color.slice(1)} ${v}`;
};
