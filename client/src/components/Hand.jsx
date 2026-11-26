import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Card } from './Card.jsx';
import { useViewport, handCardWidth, isWide } from '../lib/useViewport.js';

const ORDER = { red: 0, yellow: 1, green: 2, blue: 3, wild: 4 };
const VAL = (v) => (/^\d$/.test(v) ? Number(v) : { skip: 10, reverse: 11, draw2: 12, wild: 13, wild4: 14 }[v]);
export const sortHand = (hand) => hand.slice().sort((a, b) => ORDER[a.color] - ORDER[b.color] || VAL(a.value) - VAL(b.value));

function useWidth(ref) {
  const [w, setW] = useState(360);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/**
 * Fanned hand. Playable cards glow and lift; unplayable ones dim on your turn.
 */
export function Hand({ hand, playable, myTurn, hintCardId, onPlay, disabled, centerGap = 0 }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  const vp = useViewport();
  const cardW = handCardWidth(vp);
  const cardH = Math.round(cardW * 1.46);
  const short = isWide(vp) && vp.h < 540; // phone sideways: tighter hand
  const padH = short ? 40 : 66, yOff = short ? 8 : 20;
  const size = cardW;
  const cards = sortHand(hand);
  const n = cards.length;
  // centerGap: room left open in the middle of the fan for your seat (wide table)
  const gap = n > 1 ? centerGap : 0;
  const spacing = n <= 1 ? 0 : gap
    ? Math.min(cardW * 0.7, (width - gap - cardW * 2.6) / Math.max(1, n - 2))
    : Math.min(cardW * 0.7, (width - cardW * (width < 500 ? 1.95 : 1.6)) / (n - 1));
  // the right half moves over so the clear space between the halves is exactly `gap`
  const shift = gap ? gap + cardW - spacing : 0;
  const total = spacing * (n - 1) + shift;
  const half = Math.ceil(n / 2);
  const maxAngle = Math.min(28, n * 2.6);
  const playableSet = new Set(playable);
  const [hover, setHover] = useState(null);

  return (
    <div ref={ref} className="relative w-full isolate" style={{ height: cardH + padH }}>
      <AnimatePresence initial={false}>
        {cards.map((card, i) => {
          const t = n <= 1 ? 0 : i / (n - 1) - 0.5; // -0.5..0.5
          const angle = t * maxAngle;
          // with a seat gap, both halves grow outward from the middle so the gap stays centered under your seat
          const x = n === 1 && centerGap ? width / 2 - cardW - centerGap / 2
            : gap ? (i < half ? width / 2 - gap / 2 - cardW - (half - 1 - i) * spacing : width / 2 + gap / 2 + (i - half) * spacing)
            : width / 2 - cardW / 2 - total / 2 + i * spacing;
          const arcY = Math.abs(t) ** 2 * 40;
          const canPlay = playableSet.has(card.id) && !disabled;
          const dim = myTurn && !canPlay;
          const isHint = hintCardId === card.id;
          const lift = (canPlay ? -18 : 0) + (hover === card.id && canPlay ? -14 : 0) + (isHint ? -10 : 0);
          return (
            <motion.button
              key={card.id}
              type="button"
              onClick={() => canPlay && onPlay(card)}
              onHoverStart={() => setHover(card.id)}
              onHoverEnd={() => setHover((h) => (h === card.id ? null : h))}
              initial={{ y: -260, x: width / 2, opacity: 0, rotate: -40, scale: 0.6 }}
              animate={{ x, y: (short ? arcY * 0.5 : arcY) + (short ? lift * 0.6 : lift) + yOff, rotate: angle, opacity: 1, scale: 1 }}
              exit={{ y: -220, opacity: 0, scale: 0.8, transition: { duration: 0.25 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.7 }}
              className={`absolute left-0 top-0 origin-bottom outline-none ${canPlay ? 'cursor-pointer' : 'cursor-default'}`}
              style={{ zIndex: hover === card.id ? 100 : i }}
              aria-label={`${card.color} ${card.value}${canPlay ? ' (playable)' : ''}`}
              disabled={!canPlay}
            >
              <Card
                card={card}
                size={size}
                className={`transition-[filter,opacity] duration-200 ${isHint ? 'pulse-ring' : ''}`}
                style={{
                  filter: dim ? 'brightness(0.62) saturate(0.75)' : 'none',
                  boxShadow: canPlay
                    ? `0 0 0 3px rgba(255,255,255,.85), 0 0 22px 4px ${isHint ? 'rgba(245,196,81,.95)' : 'rgba(120,230,255,.55)'}, 0 10px 20px rgba(0,0,0,.4)`
                    : undefined,
                }}
              />
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
