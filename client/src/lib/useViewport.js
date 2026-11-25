import { useEffect, useState } from 'react';

/** Live viewport size, used to scale cards to the screen. */
export function useViewport() {
  const get = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [vp, setVp] = useState(get);
  useEffect(() => {
    const on = () => setVp(get());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  return vp;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Card width for your hand: big on desktop, still fits a phone. */
export const handCardWidth = ({ w, h }) => {
  const wide = w >= 900 && h >= 540 && w > h * 1.15; // the big table needs room for your seat under it
  return Math.round(clamp(Math.min(w * 0.1, h * (wide ? 0.14 : 0.165)), 84, 150));
};
/** Card width for the draw/discard piles. */
export const pileCardWidth = ({ w, h }) => Math.round(clamp(Math.min(w * 0.27, h * 0.13), 84, 124));
