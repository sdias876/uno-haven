import { useCallback, useRef, useState } from 'react';
import { prefs } from './socket.js';

// Just-in-time tips: each one appears the first time its situation happens, then never again.
export const TIPS = {
  firstTurn: 'Your turn! Tap a glowing card to play it. Dim cards don’t match yet.',
  noMatch: 'Nothing matches? Tap the deck in the middle to draw a card.',
  drawnPlayable: 'The card you drew matches — play it now, or tap Pass to keep it.',
  skip: 'Skip ⊘ — the next player loses their turn.',
  reverse: 'Reverse ⇄ — play now goes the other way around the table.',
  draw2: '+2 — the next player draws 2 cards and misses their turn.',
  draw2Stack: '+2 — the next player must stack another +2, or draw the whole pile-up.',
  wild: 'Wild — whoever plays it picks the next color. Play it any time.',
  wild4: '+4 — the next player draws 4, misses a turn, and the color changes.',
  stackMe: 'You can stack! Play your matching +2/+4 to pass the penalty on.',
  swap: '7 rule — playing a 7 swaps your whole hand with a player you choose.',
  rotate: '0 rule — every hand just moved to the next player.',
  jumpIn: 'Jump-In — an exact copy of the top card can be played even when it’s not your turn.',
  catchable: 'Someone forgot to call “Ek!” Tap “Catch!” under their name to make them draw 2.',
  unoTime: 'Two cards left — tap the red EK! button before you play, or you can get caught.',
  caughtMe: 'Caught! Next time, tap EK! when you’re down to two cards.',
  smartHint: 'Not sure what to play? Tap 💡 Hint and the Coach shows the best card.',
};

/** Returns { tip, show(key), dismiss() }. Remembers which tips were already shown. */
export function useTips(enabled) {
  const [tip, setTip] = useState(null);
  const seen = useRef(new Set(prefs.get('tipsSeen', [])));
  const timer = useRef(null);
  const dismiss = useCallback(() => { setTip(null); clearTimeout(timer.current); }, []);
  const show = useCallback((key) => {
    if (!enabled || !TIPS[key] || seen.current.has(key)) return;
    seen.current.add(key);
    prefs.set('tipsSeen', [...seen.current]);
    setTip({ key, text: TIPS[key] });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTip(null), 7000);
  }, [enabled]);
  return { tip, show, dismiss };
}

export function resetTips() { prefs.set('tipsSeen', []); }
