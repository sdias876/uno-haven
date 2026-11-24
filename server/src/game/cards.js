// Card model + deck utilities.
// A card: { id: string, color: 'red'|'yellow'|'green'|'blue'|'wild', value: string }
// value ∈ '0'..'9' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'

import { randomInt } from '../util.js';

export const COLORS = ['red', 'yellow', 'green', 'blue'];
export const ACTIONS = ['skip', 'reverse', 'draw2'];

export function buildDeck() {
  const deck = [];
  let n = 0;
  const add = (color, value) => deck.push({ id: `c${n++}`, color, value });
  for (const color of COLORS) {
    add(color, '0');
    for (let v = 1; v <= 9; v++) { add(color, String(v)); add(color, String(v)); }
    for (const a of ACTIONS) { add(color, a); add(color, a); }
  }
  for (let i = 0; i < 4; i++) { add('wild', 'wild'); add('wild', 'wild4'); }
  return deck; // 108 cards
}

// Cryptographically-seeded Fisher–Yates so shuffles can't be predicted by clients.
export function shuffle(arr, rng = (max) => randomInt(max)) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const isWild = (c) => c.color === 'wild';
export const isNumber = (c) => /^[0-9]$/.test(c.value);
export const isAction = (c) => ACTIONS.includes(c.value);

export function cardPoints(c) {
  if (isNumber(c)) return Number(c.value);
  if (isWild(c)) return 50;
  return 20;
}

export function cardLabel(c) {
  const names = { skip: 'Skip', reverse: 'Reverse', draw2: 'Draw Two', wild: 'Wild', wild4: 'Wild Draw Four' };
  const v = names[c.value] ?? c.value;
  if (isWild(c)) return v;
  return `${c.color[0].toUpperCase()}${c.color.slice(1)} ${v}`;
}
