import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UnoGame } from '../src/game/engine.js';
import { chooseBotMove, coachHint, BOT_LEVELS } from '../src/game/ai.js';
import { buildDeck } from '../src/game/cards.js';

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const totalCards = (g) => g.drawPile.length + g.discardPile.length + g.players.reduce((s, p) => s + p.hand.length, 0);

function setup(n, rules = {}) {
  const g = new UnoGame({ players: players(n), rules });
  g.turn = 0;
  return g;
}
const C = (id, color, value) => ({ id, color, value });

test('deck has 108 cards and deal is 7 each', () => {
  assert.equal(buildDeck().length, 108);
  const g = new UnoGame({ players: players(4) });
  for (const p of g.players) assert.equal(p.hand.length, 7);
  assert.equal(totalCards(g), 108);
  assert.match(g.top.value, /^[0-9]$/);
});

test('rejects out-of-turn and illegal plays', () => {
  const g = setup(3);
  g.discardPile = [C('t', 'red', '5')]; g.currentColor = 'red';
  g.players[0].hand = [C('a', 'blue', '3'), C('b', 'red', '9')];
  g.players[1].hand = [C('c', 'red', '1')];
  assert.equal(g.play('p1', 'c').ok, false);           // not their turn
  assert.equal(g.play('p0', 'a').ok, false);           // no match
  assert.equal(g.play('p0', 'zzz').ok, false);         // not held
  assert.equal(g.play('p0', 'b').ok, true);
  assert.equal(g.turn, 1);
});

test('wild requires a color', () => {
  const g = setup(2);
  g.players[0].hand = [C('w', 'wild', 'wild'), C('x', 'red', '1')];
  assert.equal(g.play('p0', 'w').ok, false);
  assert.equal(g.play('p0', 'w', { color: 'green' }).ok, true);
  assert.equal(g.currentColor, 'green');
});

test('skip, reverse, draw2 without stacking', () => {
  const g = setup(3);
  g.discardPile = [C('t', 'red', '5')]; g.currentColor = 'red';
  g.players[0].hand = [C('s', 'red', 'skip'), C('x', 'blue', '1')];
  g.play('p0', 's');
  assert.equal(g.turn, 2);
  g.players[2].hand = [C('r', 'red', 'reverse'), C('y', 'blue', '1')];
  g.play('p2', 'r');
  assert.equal(g.direction, -1);
  assert.equal(g.turn, 1);
  g.players[1].hand = [C('d', 'red', 'draw2'), C('z', 'blue', '1')];
  const before = g.players[0].hand.length;
  g.play('p1', 'd');
  assert.equal(g.players[0].hand.length, before + 2);
  assert.equal(g.turn, 2); // p0 skipped
});

test('reverse in 2-player acts as skip', () => {
  const g = setup(2);
  g.discardPile = [C('t', 'red', '5')]; g.currentColor = 'red';
  g.players[0].hand = [C('r', 'red', 'reverse'), C('x', 'blue', '1')];
  g.play('p0', 'r');
  assert.equal(g.turn, 0);
});

test('stacking accumulates and the loser draws the total', () => {
  const g = setup(3, { stacking: true });
  g.discardPile = [C('t', 'red', '5')]; g.currentColor = 'red';
  g.players[0].hand = [C('d1', 'red', 'draw2'), C('x', 'blue', '1')];
  g.players[1].hand = [C('d2', 'blue', 'draw2'), C('y', 'red', '7'), C('q', 'wild', 'wild4')];
  g.players[2].hand = [C('z', 'green', '1')];
  g.play('p0', 'd1');
  assert.equal(g.pendingDraw, 2);
  assert.deepEqual(g.playableCardIds('p1'), ['d2']); // only +2 on +2
  g.play('p1', 'd2');
  assert.equal(g.pendingDraw, 4);
  assert.deepEqual(g.playableCardIds('p2'), []);
  g.draw('p2');
  assert.equal(g.players[2].hand.length, 5);
  assert.equal(g.pendingDraw, 0);
  assert.equal(g.turn, 0);
  assert.equal(g.stats.p1.biggestHit.amount, 4);
});

test('7-0 rule swaps and rotates hands', () => {
  const g = setup(3, { sevenZero: true });
  g.discardPile = [C('t', 'red', '5')]; g.currentColor = 'red';
  g.players[0].hand = [C('s7', 'red', '7'), C('a', 'blue', '1'), C('b', 'blue', '2')];
  g.players[1].hand = [C('c', 'green', '1')];
  g.players[2].hand = [C('d', 'green', '2'), C('e', 'green', '3')];
  g.play('p0', 's7', { swapTargetId: 'p1' });
  assert.deepEqual(g.players[0].hand.map((c) => c.id), ['c']);
  assert.deepEqual(g.players[1].hand.map((c) => c.id), ['a', 'b']);
  assert.equal(g.unoVulnerable, null); // swapped-in hand gets a pass

  const h = setup(3, { sevenZero: true });
  h.discardPile = [C('t', 'red', '5')]; h.currentColor = 'red';
  h.players[0].hand = [C('z0', 'red', '0'), C('a', 'blue', '1')];
  h.players[1].hand = [C('c', 'green', '1')];
  h.players[2].hand = [C('d', 'green', '2')];
  h.play('p0', 'z0');
  assert.deepEqual(h.players[1].hand.map((c) => c.id), ['a']); // p0 -> p1
  assert.deepEqual(h.players[2].hand.map((c) => c.id), ['c']); // p1 -> p2
  assert.deepEqual(h.players[0].hand.map((c) => c.id), ['d']); // p2 -> p0
});

test('force play: must play a playable drawn card', () => {
  const g = setup(2, { forcePlay: true });
  g.discardPile = [C('t', 'red', '5')]; g.currentColor = 'red';
  g.players[0].hand = [C('a', 'blue', '1')];
  g.drawPile.push(C('dr', 'red', '9'));
  g.draw('p0');
  assert.equal(g.drawnCardId, 'dr');
  assert.equal(g.pass('p0').ok, false);
  assert.deepEqual(g.playableCardIds('p0'), ['dr']);
  assert.equal(g.play('p0', 'dr').ok, true);
});

test('without force play, drawn playable card can be passed; unplayable draw ends turn', () => {
  const g = setup(2);
  g.discardPile = [C('t', 'red', '5')]; g.currentColor = 'red';
  g.players[0].hand = [C('a', 'blue', '1')];
  g.drawPile.push(C('dr', 'red', '9'));
  g.draw('p0');
  assert.equal(g.pass('p0').ok, true);
  assert.equal(g.turn, 1);
  g.players[1].hand = [C('b', 'blue', '2')];
  g.drawPile.push(C('nope', 'green', '8'));
  g.draw('p1');
  assert.equal(g.turn, 0);
  assert.equal(g.lacks.p1.red !== undefined, true);
});

test('jump-in with exact duplicate out of turn', () => {
  const g = setup(4, { jumpIn: true });
  g.discardPile = [C('t', 'red', '5')]; g.currentColor = 'red';
  g.players[2].hand = [C('dup', 'red', '5'), C('x', 'blue', '1')];
  assert.deepEqual(g.playableCardIds('p2'), ['dup']);
  assert.equal(g.play('p2', 'dup').ok, true);
  assert.equal(g.turn, 3); // continues from the jumper
});

test('UNO: catch an uncalled last card, or pre-call to be safe', () => {
  const g = setup(3);
  g.discardPile = [C('t', 'red', '5')]; g.currentColor = 'red';
  g.players[0].hand = [C('a', 'red', '1'), C('b', 'blue', '1')];
  g.play('p0', 'a');
  assert.equal(g.unoVulnerable, 'p0');
  assert.equal(g.catchUno('p2', 'p0').ok, true);
  assert.equal(g.players[0].hand.length, 3);

  const h = setup(3);
  h.discardPile = [C('t', 'red', '5')]; h.currentColor = 'red';
  h.players[0].hand = [C('a', 'red', '1'), C('b', 'blue', '1')];
  assert.equal(h.callUno('p0').ok, true);
  h.play('p0', 'a');
  assert.equal(h.unoVulnerable, null);
  assert.equal(h.catchUno('p2', 'p0').ok, false);
});

test('UNO window closes when the next player acts', () => {
  const g = setup(3);
  g.discardPile = [C('t', 'red', '5')]; g.currentColor = 'red';
  g.players[0].hand = [C('a', 'red', '1'), C('b', 'blue', '1')];
  g.players[1].hand = [C('c', 'red', '2'), C('d', 'red', '3')];
  g.play('p0', 'a');
  g.play('p1', 'c');
  assert.equal(g.catchUno('p2', 'p0').ok, false);
});

test('winning ends the game and scores remaining hands', () => {
  const g = setup(2);
  g.discardPile = [C('t', 'red', '5')]; g.currentColor = 'red';
  g.players[0].hand = [C('a', 'red', '1')];
  g.players[1].hand = [C('w', 'wild', 'wild'), C('n', 'blue', '7')];
  const r = g.play('p0', 'a');
  assert.equal(g.phase, 'ended');
  assert.equal(g.winnerId, 'p0');
  assert.equal(g.score, 57);
  assert.ok(r.events.some((e) => e.type === 'win'));
  assert.ok(g.recap().winnerName === 'P0');
});

test('coach gives a hint and suggests blocking a near-winner', () => {
  const g = setup(3);
  g.discardPile = [C('t', 'yellow', '5')]; g.currentColor = 'yellow';
  g.players[0].hand = [C('sk', 'yellow', 'skip'), C('n', 'yellow', '2'), C('b', 'blue', '9')];
  g.players[1].hand = [C('x', 'red', '1'), C('y', 'red', '2')];
  const h = coachHint(g, 'p0');
  assert.equal(h.cardId, 'sk');
  assert.match(h.tip, /block/i);
});

test('views hide other hands but spectators can see them', () => {
  const g = new UnoGame({ players: players(3) });
  const v = g.view('p0');
  assert.equal(v.hand.length, 7);
  assert.equal(v.players[1].hand, undefined);
  const s = g.view('spec', { revealAll: true });
  assert.equal(s.players[1].hand.length, 7);
  assert.equal(s.hand.length, 0);
});

for (const level of BOT_LEVELS) {
  for (const rules of [{}, { stacking: true, sevenZero: true, forcePlay: true, jumpIn: true }]) {
    test(`bot-only simulation (${level}, rules=${Object.keys(rules).join(',') || 'standard'}) terminates and conserves cards`, () => {
      for (let game = 0; game < 40; game++) {
        const n = 2 + (game % 5);
        const g = new UnoGame({ players: players(n), rules });
        let steps = 0;
        while (g.phase === 'playing' && steps < 5000) {
          const pid = g.current.id;
          const m = chooseBotMove(g, pid, level);
          let r;
          if (m.type === 'play') {
            if (g.player(pid).hand.length === 2) g.callUno(pid);
            r = g.play(pid, m.cardId, m);
          } else if (m.type === 'draw') r = g.draw(pid);
          else r = g.pass(pid);
          assert.ok(r.ok, `${m.type} failed: ${r.error}`);
          assert.equal(totalCards(g), 108);
          steps++;
        }
        // Extremely long games can happen when every player hoards; allow but they must be valid
        assert.ok(steps < 5000 || g.phase === 'playing');
      }
    });
  }
}
