// Authoritative UNO game engine. Pure game logic: no sockets, no timers.
// Every mutation goes through play/draw/pass/callUno/catchUno, each of which
// validates the actor and returns { ok, error?, events[] }.

import { buildDeck, shuffle, COLORS, isWild, isNumber, cardPoints, cardLabel } from './cards.js';

export const DEFAULT_RULES = Object.freeze({
  stacking: false,   // +2 on +2, +4 on +4
  sevenZero: false,  // 7 swaps hands with a chosen player, 0 rotates all hands
  forcePlay: false,  // must play a drawn card if it's playable
  jumpIn: false,     // play an exact duplicate of the top card out of turn
});

const HAND_SIZE = 7;

export class UnoGame {
  /**
   * @param {{players: {id:string,name:string}[], rules?: object, rng?: (max:number)=>number, clock?: ()=>number}} opts
   */
  constructor({ players, rules = {}, rng, clock = () => Date.now() }) {
    if (!players || players.length < 2) throw new Error('Need at least 2 players');
    if (players.length > 10) throw new Error('Max 10 players');
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.rng = rng;
    this.clock = clock;
    this.players = players.map((p) => ({ id: p.id, name: p.name, hand: [], preCalledUno: false }));
    this.drawPile = shuffle(buildDeck(), rng);
    this.discardPile = [];
    this.direction = 1;
    this.turn = 0;
    this.currentColor = null;
    this.pendingDraw = 0;
    this.pendingType = null;   // 'draw2' | 'wild4' while a stack is open
    this.lastStackerId = null;
    this.drawnCardId = null;   // card drawn this turn that may still be played
    this.unoVulnerable = null; // playerId sitting on 1 card without calling UNO
    this.phase = 'playing';
    this.winnerId = null;
    this.turnNumber = 0;
    this.log = [];             // replay log of every move
    this.lacks = {};           // public inference: playerId -> { color: turnNumber }
    this.stats = {};
    for (const p of this.players) {
      this.stats[p.id] = {
        cardsPlayed: 0, cardsDrawn: 0, actionCards: 0, wildsPlayed: 0, unoCalls: 0,
        caughtOthers: 0, gotCaught: 0, jumpIns: 0, turnMs: [], oneCardStreak: 0,
        longestUnoStreak: 0, biggestHit: null, // { amount, victimId, via }
      };
      this.lacks[p.id] = {};
    }

    // Deal
    for (let r = 0; r < HAND_SIZE; r++) for (const p of this.players) p.hand.push(this.drawPile.pop());
    // Flip a number card to start (keeps opening simple and fair)
    let first;
    while (true) {
      first = this.drawPile.pop();
      if (isNumber(first)) break;
      this.drawPile.unshift(first);
    }
    this.discardPile.push(first);
    this.currentColor = first.color;
    this.turn = this.rngInt(this.players.length);
    this.turnStartedAt = this.clock();
    this.pushLog({ type: 'start', card: first, firstPlayer: this.players[this.turn].id });
  }

  // ---------- helpers ----------
  rngInt(max) { return this.rng ? this.rng(max) : Math.floor(Math.random() * max); }
  get top() { return this.discardPile[this.discardPile.length - 1]; }
  get current() { return this.players[this.turn]; }
  idx(playerId) { return this.players.findIndex((p) => p.id === playerId); }
  player(playerId) { return this.players[this.idx(playerId)]; }
  offset(steps, from = this.turn) {
    const n = this.players.length;
    return (((from + this.direction * steps) % n) + n) % n;
  }
  nextPlayer(from = this.turn) { return this.players[this.offset(1, from)]; }
  pushLog(entry) {
    this.log.push({ t: this.clock(), turn: this.turnNumber, ...entry });
    if (this.log.length > 500) this.log.shift();
  }

  /** Is `card` a legal play for `playerId` right now (ignoring turn ownership for jump-ins)? */
  matches(card) {
    const top = this.top;
    if (isWild(card)) return true;
    return card.color === this.currentColor || card.value === top.value;
  }

  playableCardIds(playerId) {
    if (this.phase !== 'playing') return [];
    const p = this.player(playerId);
    if (!p) return [];
    const myTurn = this.current.id === playerId;
    if (!myTurn) {
      if (!this.rules.jumpIn || this.pendingDraw > 0) return [];
      const top = this.top;
      if (isWild(top)) return [];
      return p.hand.filter((c) => c.color === top.color && c.value === top.value).map((c) => c.id);
    }
    if (this.pendingDraw > 0) {
      if (!this.rules.stacking) return [];
      return p.hand.filter((c) => c.value === this.pendingType).map((c) => c.id);
    }
    if (this.drawnCardId) {
      const c = p.hand.find((x) => x.id === this.drawnCardId);
      return c && this.matches(c) ? [c.id] : [];
    }
    return p.hand.filter((c) => this.matches(c)).map((c) => c.id);
  }

  drawCards(player, n) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length <= 1) break; // nothing left anywhere
        const top = this.discardPile.pop();
        this.drawPile = shuffle(this.discardPile, this.rng);
        this.discardPile = [top];
      }
      const c = this.drawPile.pop();
      player.hand.push(c);
      drawn.push(c);
    }
    this.stats[player.id].cardsDrawn += drawn.length;
    if (player.hand.length > 1) player.preCalledUno = false;
    return drawn;
  }

  /** Called whenever the active turn changes hands. */
  advance(steps = 1) {
    const now = this.clock();
    this.stats[this.current.id].turnMs.push(now - this.turnStartedAt);
    this.turn = this.offset(steps);
    this.turnNumber++;
    this.drawnCardId = null;
    this.turnStartedAt = now;
    for (const p of this.players) {
      const s = this.stats[p.id];
      if (p.hand.length === 1) {
        s.oneCardStreak++;
        s.longestUnoStreak = Math.max(s.longestUnoStreak, s.oneCardStreak);
      } else s.oneCardStreak = 0;
    }
  }

  /** Any action by someone other than the vulnerable player closes the "catch" window. */
  closeUnoWindow(actorId) {
    if (this.unoVulnerable && this.unoVulnerable !== actorId) this.unoVulnerable = null;
  }

  recordHit(attackerId, victimId, amount, via) {
    const s = this.stats[attackerId];
    if (!s.biggestHit || amount > s.biggestHit.amount) s.biggestHit = { amount, victimId, via };
  }

  // ---------- actions ----------
  /**
   * @param {string} playerId
   * @param {string} cardId
   * @param {{color?: string, swapTargetId?: string}} opts
   */
  play(playerId, cardId, opts = {}) {
    if (this.phase !== 'playing') return fail('Game is over');
    const p = this.player(playerId);
    if (!p) return fail('Not in this game');
    const card = p.hand.find((c) => c.id === cardId);
    if (!card) return fail('You do not hold that card');
    if (!this.playableCardIds(playerId).includes(cardId)) return fail('That card cannot be played now');
    if (isWild(card) && !COLORS.includes(opts.color)) return fail('Choose a color for your wild');

    const events = [];
    const jumpedIn = this.current.id !== playerId;
    if (jumpedIn) {
      this.stats[this.current.id].turnMs.push(this.clock() - this.turnStartedAt);
      this.turn = this.idx(playerId);
      this.drawnCardId = null;
      this.stats[playerId].jumpIns++;
      events.push({ type: 'jumpIn', playerId });
    }
    this.closeUnoWindow(playerId);

    // Move the card
    p.hand = p.hand.filter((c) => c.id !== cardId);
    this.discardPile.push(card);
    this.currentColor = isWild(card) ? opts.color : card.color;
    delete this.lacks[playerId][this.currentColor];
    const s = this.stats[playerId];
    s.cardsPlayed++;
    if (isWild(card)) s.wildsPlayed++;
    else if (!isNumber(card)) s.actionCards++;
    events.push({ type: 'play', playerId, card, color: this.currentColor });
    this.pushLog({ type: 'play', playerId, card, color: this.currentColor, jumpedIn });

    // Win check
    if (p.hand.length === 0) {
      // A final +2/+4 still lands, for scoring and drama
      if (card.value === 'draw2' || card.value === 'wild4') {
        const victim = this.nextPlayer();
        const amount = this.pendingDraw + (card.value === 'draw2' ? 2 : 4);
        this.drawCards(victim, amount);
        this.recordHit(playerId, victim.id, amount, card.value);
        events.push({ type: 'penalty', playerId: victim.id, amount, by: playerId });
        this.pendingDraw = 0; this.pendingType = null;
      }
      return { ok: true, events: [...events, ...this.finish(playerId)] };
    }

    // Effects
    const n = this.players.length;
    switch (card.value) {
      case 'skip': {
        events.push({ type: 'skip', playerId: this.nextPlayer().id });
        this.advance(2);
        break;
      }
      case 'reverse': {
        if (n === 2) {
          events.push({ type: 'skip', playerId: this.nextPlayer().id });
          this.advance(2);
        } else {
          this.direction *= -1;
          events.push({ type: 'reverse', direction: this.direction });
          this.advance(1);
        }
        break;
      }
      case 'draw2':
      case 'wild4': {
        const amount = card.value === 'draw2' ? 2 : 4;
        if (this.rules.stacking) {
          this.pendingDraw += amount;
          this.pendingType = card.value;
          this.lastStackerId = playerId;
          events.push({ type: 'stack', playerId, total: this.pendingDraw, cardValue: card.value });
          this.advance(1);
        } else {
          const victim = this.nextPlayer();
          this.drawCards(victim, amount);
          this.recordHit(playerId, victim.id, amount, card.value);
          events.push({ type: 'penalty', playerId: victim.id, amount, by: playerId });
          this.pushLog({ type: 'penalty', playerId: victim.id, amount, by: playerId });
          this.advance(2);
        }
        break;
      }
      case '7': {
        if (this.rules.sevenZero) {
          let target = this.player(opts.swapTargetId);
          if (!target || target.id === playerId) {
            // fallback: swap with the player holding the fewest cards
            target = this.players.filter((x) => x.id !== playerId).sort((a, b) => a.hand.length - b.hand.length)[0];
          }
          [p.hand, target.hand] = [target.hand, p.hand];
          p.preCalledUno = false; target.preCalledUno = false;
          events.push({ type: 'swap', playerId, targetId: target.id });
          this.pushLog({ type: 'swap', playerId, targetId: target.id });
        }
        this.advance(1);
        break;
      }
      case '0': {
        if (this.rules.sevenZero) {
          const hands = this.players.map((x) => x.hand);
          // each player passes their hand to the next player in the current direction
          this.players.forEach((x, i) => {
            const from = (((i - this.direction) % n) + n) % n;
            x.hand = hands[from];
            x.preCalledUno = false;
          });
          events.push({ type: 'rotate', direction: this.direction });
          this.pushLog({ type: 'rotate', playerId });
        }
        this.advance(1);
        break;
      }
      default:
        this.advance(1);
    }

    // UNO bookkeeping for the actor (a hand received via 7-0 gets a free pass)
    const handSwapped = this.rules.sevenZero && (card.value === '7' || card.value === '0');
    if (p.hand.length === 1 && !handSwapped) {
      if (p.preCalledUno) {
        events.push({ type: 'uno', playerId });
        this.stats[playerId].unoCalls++;
      } else {
        this.unoVulnerable = playerId;
      }
    }
    p.preCalledUno = false;
    return { ok: true, events };
  }

  draw(playerId) {
    if (this.phase !== 'playing') return fail('Game is over');
    if (this.current.id !== playerId) return fail('Not your turn');
    const p = this.current;
    this.closeUnoWindow(playerId);
    const events = [];

    if (this.pendingDraw > 0) {
      const amount = this.pendingDraw;
      this.drawCards(p, amount);
      if (this.lastStackerId) this.recordHit(this.lastStackerId, p.id, amount, this.pendingType);
      events.push({ type: 'penalty', playerId: p.id, amount, by: this.lastStackerId });
      this.pushLog({ type: 'penalty', playerId: p.id, amount, by: this.lastStackerId });
      this.pendingDraw = 0; this.pendingType = null; this.lastStackerId = null;
      this.advance(1);
      return { ok: true, events };
    }
    if (this.drawnCardId) return fail('You already drew — play it or pass');

    // Public inference: drawing voluntarily means you had nothing in this color
    this.lacks[playerId][this.currentColor] = this.turnNumber;
    const [card] = this.drawCards(p, 1);
    events.push({ type: 'draw', playerId, count: card ? 1 : 0 });
    this.pushLog({ type: 'draw', playerId });
    if (card && this.matches(card)) {
      this.drawnCardId = card.id;
      events.push({ type: 'drawnPlayable', playerId, cardId: card.id, mustPlay: this.rules.forcePlay });
    } else {
      this.advance(1);
    }
    return { ok: true, events };
  }

  pass(playerId) {
    if (this.phase !== 'playing') return fail('Game is over');
    if (this.current.id !== playerId) return fail('Not your turn');
    if (!this.drawnCardId) return fail('Draw a card before passing');
    if (this.rules.forcePlay) return fail('Force Play is on — you must play the drawn card');
    this.closeUnoWindow(playerId);
    this.pushLog({ type: 'pass', playerId });
    this.advance(1);
    return { ok: true, events: [{ type: 'pass', playerId }] };
  }

  callUno(playerId) {
    if (this.phase !== 'playing') return fail('Game is over');
    const p = this.player(playerId);
    if (!p) return fail('Not in this game');
    if (p.hand.length === 1 && this.unoVulnerable === playerId) {
      this.unoVulnerable = null;
      this.stats[playerId].unoCalls++;
      this.pushLog({ type: 'uno', playerId });
      return { ok: true, events: [{ type: 'uno', playerId }] };
    }
    // Pre-call: about to go down to one card
    if (p.hand.length === 2 && this.current.id === playerId && this.playableCardIds(playerId).length) {
      p.preCalledUno = true;
      return { ok: true, events: [{ type: 'unoReady', playerId }] };
    }
    if (p.hand.length === 1) return { ok: true, events: [] }; // already safe
    return fail('You can only call Ek when you are down to your last card');
  }

  catchUno(catcherId, targetId) {
    if (this.phase !== 'playing') return fail('Game is over');
    if (catcherId === targetId) return fail('Call Ek instead!');
    if (!this.player(catcherId)) return fail('Not in this game');
    if (this.unoVulnerable !== targetId) return fail('Too late — nobody to catch');
    const target = this.player(targetId);
    this.drawCards(target, 2);
    this.unoVulnerable = null;
    this.stats[catcherId].caughtOthers++;
    this.stats[targetId].gotCaught++;
    this.recordHit(catcherId, targetId, 2, 'catch');
    this.pushLog({ type: 'caught', playerId: targetId, by: catcherId });
    return { ok: true, events: [{ type: 'caught', playerId: targetId, by: catcherId }] };
  }

  /** Remove a player mid-game (e.g. abandoned seat). Their cards go to the bottom of the draw pile. */
  removePlayer(playerId) {
    const i = this.idx(playerId);
    if (i < 0) return;
    const wasTurn = i === this.turn;
    const [p] = this.players.splice(i, 1);
    this.drawPile.unshift(...p.hand);
    if (this.unoVulnerable === playerId) this.unoVulnerable = null;
    if (i < this.turn) this.turn--;
    if (this.turn >= this.players.length) this.turn = 0;
    if (wasTurn) { this.drawnCardId = null; this.turnStartedAt = this.clock(); }
    if (this.players.length === 1) this.finish(this.players[0].id);
  }

  finish(winnerId) {
    this.phase = 'ended';
    this.winnerId = winnerId;
    const score = this.players.reduce((sum, p) => sum + p.hand.reduce((s, c) => s + cardPoints(c), 0), 0);
    this.score = score;
    this.pushLog({ type: 'win', playerId: winnerId, score });
    return [{ type: 'win', playerId: winnerId, score }];
  }

  // ---------- views ----------
  /** Public state, plus the viewer's own hand. Spectators may see all hands. */
  view(viewerId, { revealAll = false } = {}) {
    const me = this.player(viewerId);
    return {
      phase: this.phase,
      rules: this.rules,
      top: this.top,
      discardCount: this.discardPile.length,
      recentDiscards: this.discardPile.slice(-5),
      drawCount: this.drawPile.length,
      currentColor: this.currentColor,
      direction: this.direction,
      turnPlayerId: this.current?.id,
      turnNumber: this.turnNumber,
      pendingDraw: this.pendingDraw,
      pendingType: this.pendingType,
      drawnCardId: this.current?.id === viewerId ? this.drawnCardId : null,
      unoVulnerable: this.unoVulnerable,
      winnerId: this.winnerId,
      score: this.score ?? null,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        cardCount: p.hand.length,
        hand: revealAll || this.phase === 'ended' ? p.hand : undefined,
      })),
      hand: me ? me.hand : [],
      playable: me ? this.playableCardIds(viewerId) : [],
      canPass: !!(me && this.current?.id === viewerId && this.drawnCardId && !this.rules.forcePlay),
    };
  }

  recap() {
    const players = this.players.map((p) => {
      const s = this.stats[p.id];
      const avg = s.turnMs.length ? Math.round(s.turnMs.reduce((a, b) => a + b, 0) / s.turnMs.length) : 0;
      return { id: p.id, name: p.name, cardsLeft: p.hand.length, ...s, avgTurnMs: avg, turnMs: undefined };
    });
    const nameOf = (id) => this.player(id)?.name ?? 'someone';
    let ruthless = null;
    for (const pl of players) {
      if (pl.biggestHit && (!ruthless || pl.biggestHit.amount > ruthless.amount)) {
        ruthless = { by: pl.name, byId: pl.id, victim: nameOf(pl.biggestHit.victimId), amount: pl.biggestHit.amount, via: pl.biggestHit.via };
      }
    }
    const longestUno = players.reduce((a, b) => (b.longestUnoStreak > (a?.longestUnoStreak ?? 0) ? b : a), null);
    const timed = players.filter((p) => p.avgTurnMs > 0);
    const fastest = timed.sort((a, b) => a.avgTurnMs - b.avgTurnMs)[0] ?? null;
    return {
      winnerId: this.winnerId,
      winnerName: nameOf(this.winnerId),
      score: this.score ?? 0,
      totalTurns: this.turnNumber,
      highlights: {
        mostRuthless: ruthless,
        longestUnoStreak: longestUno && longestUno.longestUnoStreak > 0 ? { name: longestUno.name, turns: longestUno.longestUnoStreak } : null,
        fastest: fastest ? { name: fastest.name, avgTurnMs: fastest.avgTurnMs } : null,
      },
      players,
      timeline: this.log.filter((e) => ['play', 'penalty', 'caught', 'uno', 'swap', 'rotate', 'win'].includes(e.type)).slice(-40)
        .map((e) => ({ ...e, name: nameOf(e.playerId), label: e.card ? cardLabel(e.card) : undefined })),
    };
  }
}

function fail(error) { return { ok: false, error, events: [] }; }
