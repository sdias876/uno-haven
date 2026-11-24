// Smart bots (Casual / Tactical / Ruthless) and the Smart Coach hint engine.
// Bots only use information a real player could know: their own hand,
// the public discard history, card counts, and public "lacks" inferences
// (a player who voluntarily draws on red probably has no red).

import { COLORS, isWild, isNumber, cardLabel, cardPoints } from './cards.js';

export const BOT_LEVELS = ['casual', 'tactical', 'ruthless'];
/** 'smart' = adaptive: plays at a strength (0..1) that the room tunes after every match. */
export const ALL_LEVELS = ['smart', ...BOT_LEVELS];

/**
 * Turn the adaptive 'smart' level into a concrete style for one decision.
 * strength 0.1 → almost always casual; 0.95 → mostly ruthless.
 */
export function resolveLevel(level, strength = 0.45, rand = Math.random) {
  if (level !== 'smart') return level;
  const r = rand();
  if (r < strength * strength) return 'ruthless';
  if (r < strength) return 'tactical';
  return 'casual';
}

const BOT_NAMES = {
  casual: ['Penny', 'Milo', 'Daisy', 'Otis', 'Juniper', 'Benny'],
  tactical: ['Atlas', 'Nova', 'Quill', 'Rook', 'Sage', 'Vega'],
  ruthless: ['Viper', 'Havoc', 'Blitz', 'Onyx', 'Reaper', 'Fang'],
  smart: ['Pixel', 'Mochi', 'Echo', 'Juno', 'Ziggy', 'Kodi'],
};
export function botName(level, taken = []) {
  const pool = BOT_NAMES[level] ?? BOT_NAMES.tactical;
  const free = pool.filter((n) => !taken.includes(`${n} 🤖`));
  return `${(free[0] ?? pool[Math.floor(Math.random() * pool.length)])} 🤖`;
}

/** Cards of each color not visible to `playerId` (still in someone's hand or the draw pile). */
function unseenByColor(game, playerId) {
  const counts = { red: 25, yellow: 25, green: 25, blue: 25 };
  const me = game.player(playerId);
  for (const c of [...game.discardPile, ...me.hand]) if (!isWild(c)) counts[c.color]--;
  return counts;
}

function likelyLacks(game, playerId, color) {
  const t = game.lacks[playerId]?.[color];
  return t !== undefined && game.turnNumber - t < game.players.length * 3;
}

/** Choose the best color after playing a wild. */
export function chooseColor(game, playerId, level = 'tactical', excludeCardId) {
  const me = game.player(playerId);
  const hand = me.hand.filter((c) => c.id !== excludeCardId && !isWild(c));
  const mine = Object.fromEntries(COLORS.map((c) => [c, 0]));
  for (const c of hand) mine[c.color] += 1 + (isNumber(c) ? 0 : 0.3);
  if (level === 'casual') {
    const best = COLORS.filter((c) => mine[c] > 0);
    return (best.length ? best : COLORS)[Math.floor(Math.random() * (best.length || 4))];
  }
  const next = game.nextPlayer(game.idx(playerId));
  const danger = next.hand.length <= 2;
  const unseen = unseenByColor(game, playerId);
  let bestColor = COLORS[0], bestScore = -Infinity;
  for (const color of COLORS) {
    let score = mine[color] * 3;
    if (level === 'ruthless') {
      // Disrupt: pick a color the next opponent is believed to lack
      if (likelyLacks(game, next.id, color)) score += danger ? 9 : 4;
      // Fewer unseen cards of this color => opponents less likely to match
      score += (25 - unseen[color]) * 0.15;
    } else if (danger && likelyLacks(game, next.id, color)) {
      score += 3;
    }
    if (score > bestScore) { bestScore = score; bestColor = color; }
  }
  return bestColor;
}

/**
 * Evaluate a playable card. Returns { score, tip } where tip explains the
 * single most important reason — this powers both bots and the Smart Coach.
 */
export function evaluateCard(game, playerId, card, level = 'ruthless') {
  const me = game.player(playerId);
  const meIdx = game.idx(playerId);
  const n = game.players.length;
  const nextIdx = (((meIdx + game.direction) % n) + n) % n;
  const next = game.players[nextIdx];
  const opponents = game.players.filter((p) => p.id !== playerId);
  const minOpp = Math.min(...opponents.map((p) => p.hand.length));
  const emergency = minOpp <= 2;
  const nextDanger = next.hand.length <= 2;
  const handAfter = me.hand.filter((c) => c.id !== card.id);
  const reasons = [];
  const add = (w, text) => reasons.push({ w, text });

  // Base: shed points, keep flexibility
  add(cardPoints(card) / 10, `Dump the ${cardLabel(card)} — high-point cards hurt if someone else goes out.`);
  const sameColorLeft = isWild(card) ? 0 : handAfter.filter((c) => c.color === card.color).length;
  add(sameColorLeft * 1.2, `Stay in ${card.color} — you still hold ${sameColorLeft} more to follow up with.`);

  if (handAfter.length === 0) add(1000, 'This is your last card — play it and win!');
  if (handAfter.length === 1) add(3, "This drops you to one card — don't forget to hit UNO!");

  // Stacking: any stack beats eating the penalty
  if (game.pendingDraw > 0) add(40, `Stack it! Pass the +${game.pendingDraw + (card.value === 'wild4' ? 4 : 2)} on instead of drawing.`);

  const who = next.name.replace(' 🤖', '');
  switch (card.value) {
    case 'skip':
      add(nextDanger ? 22 : 2, nextDanger
        ? `Play your ${cardLabel(card)} now to block ${who}, who only has ${next.hand.length} card${next.hand.length === 1 ? '' : 's'} left.`
        : `A Skip keeps the pressure on ${who}.`);
      break;
    case 'reverse': {
      const prev = game.players[(((meIdx - game.direction) % n) + n) % n];
      if (n === 2) add(nextDanger ? 22 : 2, `Reverse acts like a Skip with two players — block ${who}.`);
      else if (nextDanger && prev.hand.length > next.hand.length) add(16, `Reverse the direction so ${who} (${next.hand.length} cards) has to wait.`);
      else add(0.5, 'Reverse changes who moves next.');
      break;
    }
    case 'draw2':
      add(nextDanger ? 26 : 4, nextDanger
        ? `Hit ${who} with a Draw Two — they're about to go out.`
        : `Draw Two slows ${who} down.`);
      break;
    case 'wild':
      add(level === 'casual' ? 0 : (handAfter.length <= 1 ? 4 : -5), 'Save your Wild for when you have no other match.');
      break;
    case 'wild4':
      if (emergency) add(nextDanger ? 30 : 12, `Emergency! Drop the Wild Draw Four on ${who} to stop them winning.`);
      else add(level === 'casual' ? 0 : -12, 'Hold the Wild Draw Four for an emergency.');
      break;
    case '7':
      if (game.rules.sevenZero) {
        const target = opponents.slice().sort((a, b) => a.hand.length - b.hand.length)[0];
        const gain = handAfter.length - target.hand.length;
        add(gain * 3, gain > 0
          ? `Swap hands with ${target.name.replace(' 🤖', '')} — you'd go from ${handAfter.length} to ${target.hand.length} cards.`
          : 'Swapping now would give you a bigger hand.');
      }
      break;
    case '0':
      if (game.rules.sevenZero) {
        const prev = game.players[(((meIdx - game.direction) % n) + n) % n];
        const gain = handAfter.length - prev.hand.length;
        add(gain * 2, gain > 0 ? `Rotate hands — you'd pick up ${prev.name.replace(' 🤖', '')}'s smaller hand.` : 'Rotating would hand you more cards.');
      }
      break;
    default:
  }

  // Exploit public knowledge: next player recently drew on this color
  if (level !== 'casual' && !isWild(card) && likelyLacks(game, next.id, card.color)) {
    add(level === 'ruthless' ? 7 : 3, `${who} drew on ${card.color} recently — they probably can't follow it.`);
  }

  // Rare colors are harder for opponents to match
  if (level === 'ruthless' && !isWild(card)) {
    const unseen = unseenByColor(game, playerId);
    add((25 - unseen[card.color]) * 0.1, `${card.color} is running low — opponents are less likely to match.`);
  }

  const score = reasons.reduce((s, r) => s + r.w, 0);
  const tip = reasons.slice().sort((a, b) => b.w - a.w)[0]?.text ?? '';
  return { score, tip };
}

/** Pick a 7-swap target. */
function swapTarget(game, playerId) {
  return game.players.filter((p) => p.id !== playerId).sort((a, b) => a.hand.length - b.hand.length)[0]?.id;
}

/**
 * Decide a bot move for the player whose turn it is.
 * @returns {{type:'play', cardId, color?, swapTargetId?} | {type:'draw'} | {type:'pass'}}
 */
export function chooseBotMove(game, playerId, level = 'tactical') {
  const me = game.player(playerId);
  const playable = game.playableCardIds(playerId).map((id) => me.hand.find((c) => c.id === id));

  if (!playable.length) {
    if (game.drawnCardId) return { type: 'pass' };
    return { type: 'draw' };
  }

  let pick;
  if (level === 'casual') {
    // Mostly random, avoids hoarding nothing, sometimes sensible
    pick = Math.random() < 0.3
      ? best(game, playerId, playable, 'tactical')
      : playable[Math.floor(Math.random() * playable.length)];
  } else {
    pick = best(game, playerId, playable, level);
    // Keep a freshly drawn wild if there's no pressure (unless forced to play it)
    if (game.drawnCardId && !game.rules.forcePlay && isWild(pick)) {
      const minOpp = Math.min(...game.players.filter((p) => p.id !== playerId).map((p) => p.hand.length));
      if (minOpp > 2 && me.hand.length > 2) return { type: 'pass' };
    }
  }

  const move = { type: 'play', cardId: pick.id };
  if (isWild(pick)) move.color = chooseColor(game, playerId, level, pick.id);
  if (pick.value === '7' && game.rules.sevenZero) move.swapTargetId = swapTarget(game, playerId);
  return move;
}

function best(game, playerId, cards, level) {
  let top = cards[0], topScore = -Infinity;
  for (const c of cards) {
    let { score } = evaluateCard(game, playerId, c, level);
    if (level === 'tactical') score += Math.random() * 2; // a little human-like noise
    if (score > topScore) { topScore = score; top = c; }
  }
  return top;
}

/** Whether a bot remembers to call UNO, and how fast bots catch others (ms). */
export function botRemembersUno(level) {
  return level === 'casual' ? Math.random() > 0.3 : true;
}
export function botCatchDelay(level) {
  if (level === 'ruthless') return 900 + Math.random() * 600;
  if (level === 'tactical') return Math.random() < 0.6 ? 1800 + Math.random() * 1200 : null;
  return Math.random() < 0.2 ? 2600 : null;
}

/** Smart Coach: best move + one-sentence tip for a human player. */
export function coachHint(game, playerId) {
  if (game.phase !== 'playing') return { cardId: null, tip: 'The game is over.' };
  const me = game.player(playerId);
  if (!me) return { cardId: null, tip: '' };
  if (game.current.id !== playerId) {
    const jump = game.playableCardIds(playerId);
    if (jump.length) return { cardId: jump[0], tip: 'Jump-In! You hold an exact match of the top card — slam it down now.' };
    const next = game.nextPlayer();
    return { cardId: null, tip: `Not your turn yet. Watch ${next.name.replace(' 🤖', '')} — if anyone forgets UNO, hit Catch!` };
  }
  const playable = game.playableCardIds(playerId).map((id) => me.hand.find((c) => c.id === id));
  if (!playable.length) {
    if (game.pendingDraw > 0) return { cardId: null, action: 'draw', tip: `No card to stack — take the +${game.pendingDraw} and regroup.` };
    if (game.drawnCardId) return { cardId: null, action: 'pass', tip: 'That drawn card does not match. Pass your turn.' };
    return { cardId: null, action: 'draw', tip: `Nothing matches ${game.currentColor} or ${game.top.value} — draw a card.` };
  }
  let topCard = null, topScore = -Infinity, tip = '';
  for (const c of playable) {
    const r = evaluateCard(game, playerId, c, 'ruthless');
    if (r.score > topScore) { topScore = r.score; topCard = c; tip = r.tip; }
  }
  const label = cardLabel(topCard);
  const holdsWild4 = me.hand.some((c) => c.value === 'wild4' && c.id !== topCard.id);
  const minOpp = Math.min(...game.players.filter((p) => p.id !== playerId).map((p) => p.hand.length));
  if (me.hand.length === 1) {
    tip = 'This is your last card — play it and win!';
  } else if (playable.every(isWild) && game.pendingDraw === 0) {
    tip = topCard.value === 'wild' && holdsWild4
      ? `Nothing else matches ${game.currentColor} or ${game.top.value} — use the plain Wild and keep your +4 for an emergency.`
      : `Only your ${label} fits right now — play it and steer the color your way.`;
  } else if (!tip.includes(label) && !/^(Stack|Emergency|This)/.test(tip)) {
    tip = `Play your ${label}. ${tip}`;
  }
  if (!isWild(topCard) && me.hand.some(isWild) && minOpp > 2 && !/Wild/.test(tip)) tip += ' Save your Wilds for later.';
  const result = { cardId: topCard.id, tip };
  if (isWild(topCard)) {
    result.color = chooseColor(game, playerId, 'ruthless', topCard.id);
    result.tip += ` Then pick ${result.color}.`;
  }
  return result;
}
