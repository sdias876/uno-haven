import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from './Avatar.jsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../lib/store.jsx';
import { prefs } from '../lib/socket.js';
import { sound, play } from '../lib/sound.js';
import { useVoiceUno, voiceSupported } from '../lib/useVoiceUno.js';
import { Card, COLOR_HEX, cardName } from './Card.jsx';
import { Hand } from './Hand.jsx';
import { useViewport, pileCardWidth } from '../lib/useViewport.js';
import { ColorPicker, SwapPicker } from './Pickers.jsx';
import { ChatPanel, EmoteBar, EmoteLayer } from './Social.jsx';
import { Recap } from './Recap.jsx';
import { Logo } from './Logo.jsx';
import { useTips } from '../lib/tips.js';
import { TableShape } from './TableShape.jsx';
import { cityOf } from '../lib/city.js';
import { fmt } from '../shell/wallet.js';

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const valueName = (v) => ({ skip: 'Skip', reverse: 'Reverse', draw2: '+2', wild: 'Wild', wild4: '+4' }[v] ?? v);

function useCountdown(msLeft, key) {
  const [left, setLeft] = useState(msLeft);
  const deadline = useRef(null);
  useEffect(() => {
    deadline.current = msLeft == null ? null : Date.now() + msLeft;
    setLeft(msLeft);
  }, [msLeft, key]);
  useEffect(() => {
    if (deadline.current == null) return undefined;
    const t = setInterval(() => setLeft(Math.max(0, deadline.current - Date.now())), 200);
    return () => clearInterval(t);
  }, [msLeft, key]);
  return left;
}

export function useMuted() {
  const [m, setM] = useState(sound.isMuted());
  useEffect(() => sound.subscribe(setM), []);
  return [m, (v) => sound.setMuted(v)];
}

function MenuRow({ icon, label, sub, on, onClick, danger }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left hover:bg-white/10 ${danger ? 'text-rose-300' : ''}`}>
      <span className="text-xl w-7 text-center">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold">{label}</span>
        {sub && <span className="block text-xs text-white/55">{sub}</span>}
      </span>
      {on !== undefined && (
        <span className={`relative w-11 h-6 rounded-full shrink-0 transition ${on ? 'bg-emerald-500' : 'bg-white/20'}`}>
          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
        </span>
      )}
    </button>
  );
}

/** One ☰ menu holds everything that isn't the game itself. */
function TopBar({ onChat, unread, voiceOn, setVoiceOn, listening, coachOn, setCoachOn, tipsOn, setTipsOn }) {
  const { room, actions, toast, mode } = useGame();
  const [muted, setMuted] = useMuted();
  const [open, setOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const online = mode === 'online';
  const invite = async () => {
    const url = `${window.location.origin}/?room=${room.code}`;
    try {
      if (navigator.share && /Mobi/i.test(navigator.userAgent)) await navigator.share({ title: 'Join my Ek Haven table', url });
      else { await navigator.clipboard.writeText(url); toast('Invite link copied!', 'good'); }
    } catch { /* cancelled */ }
  };
  const close = () => { setOpen(false); setConfirmLeave(false); };
  return (
    <header className="relative z-40 flex items-center gap-2 px-3 py-2">
      <Logo size={30} />
      {!online && <span className="chip bg-white/8 text-white/60 hidden sm:inline">Solo game, works offline</span>}
      {online && room.spectators.length > 0 && <span className="chip bg-white/10">👀 {room.spectators.length}</span>}
      {voiceOn && listening && <span className="chip bg-emerald-500/30" title="Say “Ek!”">🎙️</span>}
      <span className="ml-auto" />
      {online && (
        <button onClick={onChat} aria-label="Open chat" className="round-ui relative">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" aria-hidden><path d="M4 5h16v11H9l-5 4z" /></svg>
          {unread > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-uno-red text-[11px] font-bold grid place-items-center">{unread}</span>}
        </button>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}
        className="round-ui relative">
        <svg viewBox="0 0 24 24" width="26" height="26" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M5 7h14M5 12h14M5 17h14" /></svg>
        {!online && unread > 0 && !open && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-uno-red text-[11px] font-bold grid place-items-center">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
            <motion.nav className="glass !bg-felt-800/95 absolute right-3 top-[72px] z-50 w-72 rounded-3xl p-2 shadow-2xl"
              initial={{ opacity: 0, y: -10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 500, damping: 34 }}>
              {online && <MenuRow icon="🔗" label="Invite friends" sub={`Copies a link to table ${room.code}`} onClick={() => { invite(); close(); }} />}
              {online && <MenuRow icon="💬" label={`Chat${unread ? ` (${unread} new)` : ''}`} onClick={() => { onChat(); close(); }} />}
              <MenuRow icon={muted ? '🔇' : '🔊'} label="Sound" on={!muted} onClick={() => setMuted(!muted)} />
              <MenuRow icon="🦉" label="Smart Coach" sub="Shows the 💡 hint button" on={coachOn} onClick={() => setCoachOn(!coachOn)} />
              <MenuRow icon="💡" label="Tips for new players" sub="Explains special cards the first time" on={tipsOn} onClick={() => setTipsOn(!tipsOn)} />
              {voiceSupported && <MenuRow icon="🎤" label="Voice call" sub="Say “Ek!” instead of tapping" on={voiceOn} onClick={() => setVoiceOn(!voiceOn)} />}
              <div className="h-px bg-white/10 my-1" />
              {!confirmLeave
                ? <MenuRow icon="🚪" label="Leave table" onClick={() => setConfirmLeave(true)} />
                : <MenuRow icon="⚠️" label="Tap again to leave" sub="Your seat goes to a bot" danger onClick={() => { close(); actions.leave(); }} />}
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

function Opponent({ seat, player, isTurn, vulnerable, onCatch, revealHand, timerPct, big }) {
  const count = player?.cardCount ?? 0;
  const shown = Math.min(count, 8);
  return (
    <motion.div layout className="flex flex-col items-center gap-1.5 min-w-[84px]">
      <div className="relative">
        {isTurn && timerPct != null && (
          <svg className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] -rotate-90" viewBox="0 0 60 60" aria-hidden>
            <circle cx="30" cy="30" r="27" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="3.5" />
            <circle cx="30" cy="30" r="27" fill="none" stroke={timerPct < 0.3 ? '#ff5a5d' : '#d9b26a'} strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={`${170 * timerPct} 170`} />
          </svg>
        )}
        <div className={`${big ? 'seat-ring' : 'w-12 h-12 sm:w-14 sm:h-14'} rounded-full grid place-items-center text-2xl sm:text-3xl transition
          ${isTurn ? 'bg-gradient-to-b from-[#2a3675] to-[#18214f] shadow-[0_0_0_3px_#d9b26a,0_0_24px_rgba(217,178,106,.45)]' : 'bg-gradient-to-b from-[#1f2a5e] to-[#121a45] shadow-[0_0_0_2px_rgba(255,255,255,.12)]'}
          ${!seat.connected ? 'opacity-50' : ''}`}>
          {big ? <Avatar k={seat.avatar} size={96} /> : <Avatar k={seat.avatar} size={48} className="sm:!w-14 sm:!h-14" />}
        </div>
        {seat.autopilot && <span className="absolute -bottom-1 -right-1 chip bg-sky-500 !px-1.5 !py-0.5 text-[10px]" title="Autopilot is playing">🤖</span>}
        {count === 1 && !vulnerable && <span className="absolute -top-2 -right-4 chip bg-uno-red text-white font-display !text-[11px] rotate-12 shadow">EK</span>}
      </div>
      <div className={big ? `seat-name ${isTurn ? 'turn' : ''}` : `text-xs sm:text-sm font-semibold max-w-[110px] truncate px-2.5 py-0.5 rounded-full ${isTurn ? 'bg-gold text-[#1b1405]' : 'bg-black/30 text-white/85'}`}>
        {seat.name.replace(' 🤖', '')}
      </div>
      {revealHand && player?.hand ? (
        <div className="flex -space-x-8 max-w-[220px] overflow-hidden">
          {player.hand.slice(0, 10).map((c) => <Card key={c.id} card={c} size="sm" />)}
        </div>
      ) : big ? (
        <div className="seat-count" aria-label={`${count} cards`}><Card faceDown size={30} /><b>{count}</b></div>
      ) : (
        <div className="relative h-[58px] flex items-end justify-center" style={{ width: 36 + shown * 10 }}>
          {Array.from({ length: shown }).map((_, i) => (
            <Card key={i} faceDown size={36} className="!absolute bottom-0" style={{ left: i * 10, transform: `rotate(${(i - shown / 2) * 4}deg)` }} />
          ))}
          <span className="absolute -right-3 -bottom-1 min-w-6 h-6 px-1 rounded-full grid place-items-center text-xs font-bold text-[#1b1405] shadow"
            style={{ background: 'linear-gradient(180deg,#f3d899,#c99a4e)' }} aria-label={`${count} cards`}>{count}</span>
        </div>
      )}
      <AnimatePresence>
        {vulnerable && (
          <motion.button initial={{ scale: 0 }} animate={{ scale: [1, 1.12, 1] }} exit={{ scale: 0 }} transition={{ repeat: Infinity, duration: 0.7 }}
            onClick={onCatch} className="btn !py-1 !px-3 bg-uno-red text-white text-sm shadow-lg">Catch them!</motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CenterPiles({ game, canDraw, onDraw, lastPlayFrom }) {
  const discards = game.recentDiscards.slice(-4);
  const pw = pileCardWidth(useViewport());
  const ph = Math.round(pw * 1.46);
  const ring = Math.round(pw * 3.3);
  return (
    <div className="relative flex items-center justify-center gap-6 sm:gap-10">
      {/* The table: brass-rimmed felt oval, lit in the active color */}
      <div className="absolute table-oval pointer-events-none" style={{ width: Math.min(ring * 1.45, window.innerWidth - 28), height: ph + 150, top: -46 }}>
        <div className="absolute inset-[7%] rounded-[50%] transition-[box-shadow] duration-500"
          style={{ boxShadow: `inset 0 0 0 2px ${COLOR_HEX[game.currentColor]}55, inset 0 0 50px ${COLOR_HEX[game.currentColor]}40` }} />
        <motion.div key={game.direction} initial={{ rotate: game.direction === 1 ? -180 : 180 }} animate={{ rotate: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}
          className="absolute -left-[16px] top-1/2 -mt-[18px] w-9 h-9 rounded-full grid place-items-center text-lg text-[#1b1405] shadow-lg"
          style={{ background: 'linear-gradient(180deg,#f3d899,#c99a4e)' }}
          title={game.direction === 1 ? 'Play goes clockwise' : 'Play goes counter-clockwise'}>
          {game.direction === 1 ? '↻' : '↺'}
        </motion.div>
      </div>

      {/* Draw pile */}
      <motion.button onClick={onDraw} disabled={!canDraw} whileHover={canDraw ? { y: -4, rotate: -2 } : {}} whileTap={canDraw ? { scale: 0.94 } : {}}
        className={`relative ${canDraw ? 'cursor-pointer' : 'cursor-default'}`} aria-label="Draw a card">
        {[2, 1, 0].map((i) => (
          <Card key={i} faceDown size={pw} className={i ? '!absolute' : ''} style={{ top: -i * 2, left: -i * 2 }} />
        ))}
        {canDraw && <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs font-semibold text-gold whitespace-nowrap animate-pulse">
          {game.pendingDraw > 0 ? `Take +${game.pendingDraw}` : 'Tap to draw'}
        </span>}
        <span className="absolute -top-2 -right-2 chip bg-black/60 text-white/70 text-[10px]" aria-label={`${game.drawCount} cards left in the deck`}>{game.drawCount}</span>
      </motion.button>

      {/* Discard pile */}
      <div className="relative" style={{ width: pw, height: ph }}>
        <AnimatePresence initial={false}>
          {discards.map((c, i) => {
            const isTop = i === discards.length - 1;
            const rot = (hash(c.id) % 24) - 12;
            return (
              <motion.div key={c.id} className="absolute inset-0"
                initial={isTop ? { y: lastPlayFrom === 'me' ? 260 : -220, x: 0, scale: 1.3, rotate: rot - 90, opacity: 0 } : false}
                animate={{ y: 0, x: 0, scale: 1, rotate: rot, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}>
                <Card card={c} size={pw} chosenColor={isTop ? game.currentColor : undefined} />
              </motion.div>
            );
          })}
        </AnimatePresence>
        {game.pendingDraw > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-4 -right-6 chip bg-uno-red text-white text-sm shadow-lg z-10">
            +{game.pendingDraw}
          </motion.span>
        )}
      </div>
    </div>
  );
}

function Coach({ tip, onClose }) {
  return (
    <AnimatePresence>
      {tip && (
        <motion.div initial={{ y: 20, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 10, opacity: 0 }}
          className="glass rounded-2xl px-4 py-2.5 max-w-md mx-auto flex items-start gap-3 shadow-2xl border-gold/40">
          <span className="text-2xl">🦉</span>
          <div className="text-sm leading-snug"><span className="font-display text-gold mr-1">Coach:</span>{tip}</div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-sm ml-1">✕</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TipBubble({ tip, onClose }) {
  return (
    <AnimatePresence>
      {tip && (
        <motion.div key={tip.key} initial={{ y: 16, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 8, opacity: 0 }}
          className="glass rounded-2xl px-4 py-2.5 max-w-md mx-auto flex items-center gap-3 shadow-2xl">
          <span className="text-xl">💡</span>
          <div className="text-sm leading-snug flex-1">{tip.text}</div>
          <button onClick={onClose} className="chip bg-white/15 hover:bg-white/25 shrink-0">Got it</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Where opponents sit around the big table, clockwise from your left (by number of opponents).
const SLOTS = { 1: ['top'], 2: ['left', 'right'], 3: ['left', 'top', 'right'], 4: ['left', 'tl', 'tr', 'right'], 5: ['left', 'tl', 'top', 'tr', 'right'] };

export function Table() {
  const { room, game, me, actions, shake, lastFx, chat, mode } = useGame();
  const vp = useViewport();
  // Computers, tablets and phones held sideways get Spade Haven's big table; phones held upright keep the compact layout.
  const wide = vp.w >= 900 && vp.h >= 540 && vp.w > vp.h * 1.15;
  const [chatOpen, setChatOpen] = useState(false);
  const [emotesOpen, setEmotesOpen] = useState(false);
  const [tipsOn, setTipsOn] = useState(() => prefs.get('tips', true));
  const { tip, show: showTip, dismiss: dismissTip } = useTips(tipsOn);
  const chatCount = chat.filter((m) => !m.system).length;
  const [seenChat, setSeenChat] = useState(chatCount);
  useEffect(() => { if (chatOpen) setSeenChat(chatCount); }, [chatOpen, chatCount]);
  const unread = Math.max(0, chatCount - seenChat);
  const [pendingWild, setPendingWild] = useState(null);
  const [pendingSeven, setPendingSeven] = useState(null);
  const [hint, setHint] = useState(null);
  const [coachOn, setCoachOn] = useState(() => prefs.get('coach', true));
  const [voiceOn, setVoiceOn] = useState(() => prefs.get('voice', false));
  const [shaking, setShaking] = useState(false);

  useEffect(() => { prefs.set('coach', coachOn); }, [coachOn]);
  useEffect(() => { prefs.set('voice', voiceOn); }, [voiceOn]);
  useEffect(() => { prefs.set('tips', tipsOn); }, [tipsOn]);
  useEffect(() => { if (!shake) return; setShaking(true); const t = setTimeout(() => setShaking(false), 560); return () => clearTimeout(t); }, [shake]);

  const myId = me?.id;
  const spectator = me?.role === 'spectator';
  const seatsById = useMemo(() => Object.fromEntries(room.seats.map((s) => [s.id, s])), [room.seats]);
  const myTurn = game?.turnPlayerId === myId && game?.phase === 'playing';
  const myCount = game?.hand.length ?? 0;
  const vulnerableMe = game?.unoVulnerable === myId;
  const canPreCall = myTurn && myCount === 2 && game.playable.length > 0;
  const showUno = vulnerableMe || canPreCall;

  // Clear hint when the situation changes
  useEffect(() => { setHint(null); }, [game?.turnNumber, myCount, game?.drawnCardId]);
  // If the turn moves on (e.g. timer ran out) while a picker is open, close it
  useEffect(() => { setPendingWild(null); setPendingSeven(null); }, [game?.turnNumber]);

  // Opponents in seat order starting after me
  const others = useMemo(() => {
    if (!game) return [];
    const ps = game.players;
    const start = Math.max(0, ps.findIndex((p) => p.id === myId));
    const ordered = spectator ? ps : [...ps.slice(start + 1), ...ps.slice(0, start)];
    return ordered.map((p) => ({ player: p, seat: seatsById[p.id] ?? { id: p.id, name: p.name, avatar: '🙂', connected: true } }));
  }, [game, myId, seatsById, spectator]);

  const seatPositions = useMemo(() => {
    const pos = {};
    others.forEach((o, i) => { pos[o.player.id] = { x: `${((i + 1) / (others.length + 1)) * 100}%`, y: '16%' }; });
    if (myId) pos[myId] = { x: '50%', y: '68%' };
    return pos;
  }, [others, myId]);

  const lastPlay = lastFx.find((e) => e.type === 'play');
  const lastPlayFrom = lastPlay?.playerId === myId ? 'me' : 'them';
  const msLeft = useCountdown(room.turnMsLeft, `${game?.turnNumber}-${game?.turnPlayerId}`);
  const timerPct = room.turnMsLeft != null && room.settings.turnSeconds ? Math.min(1, msLeft / (room.settings.turnSeconds * 1000)) : null;
  const secsLeft = msLeft != null ? Math.ceil(msLeft / 1000) : null;
  useEffect(() => { if (myTurn && secsLeft != null && secsLeft <= 5 && secsLeft > 0) play('tick'); }, [secsLeft, myTurn]);

  const doUno = useCallback(() => { if (showUno) actions.uno(); }, [showUno, actions]);
  const { listening } = useVoiceUno(voiceOn && !spectator && game?.phase === 'playing', doUno);

  const handlePlay = useCallback((card) => {
    if (card.color === 'wild') return setPendingWild(card);
    if (card.value === '7' && game.rules.sevenZero && myCount > 1) return setPendingSeven(card);
    actions.playCard(card.id);
  }, [actions, game?.rules.sevenZero, myCount]);

  const askHint = async () => {
    const r = await actions.hint();
    if (r.hint) setHint(r.hint);
  };

  // ---- Just-in-time tips ----
  const myTurns = useRef(0);
  useEffect(() => {
    if (spectator) return;
    for (const e of lastFx) {
      if (e.type === 'play') {
        const v = e.card.value;
        if (v === 'draw2') showTip(game?.rules.stacking ? 'draw2Stack' : 'draw2');
        else if (['skip', 'reverse', 'wild', 'wild4'].includes(v)) showTip(v);
      }
      if (e.type === 'swap') showTip('swap');
      if (e.type === 'rotate') showTip('rotate');
      if (e.type === 'jumpIn') showTip('jumpIn');
      if (e.type === 'caught' && e.playerId === myId) showTip('caughtMe');
    }
  }, [lastFx]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!game || spectator || game.phase !== 'playing') return;
    if (game.unoVulnerable && game.unoVulnerable !== myId) showTip('catchable');
    if (!myTurn) return;
    myTurns.current++;
    if (myTurns.current === 1) showTip('firstTurn');
    else if (canPreCall) showTip('unoTime');
    else if (game.pendingDraw > 0 && game.playable.length) showTip('stackMe');
    else if (game.drawnCardId) showTip('drawnPlayable');
    else if (!game.playable.length && !game.pendingDraw) showTip('noMatch');
    else if (myTurns.current >= 4 && coachOn) showTip('smartHint');
  }, [game?.turnNumber, game?.drawnCardId, game?.unoVulnerable, myTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'u') doUno();
      if (k === 'd' && myTurn && !game.drawnCardId) actions.draw();
      if (k === 'p' && game?.canPass) actions.pass();
      if (k === 'h' && coachOn && !spectator) askHint();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!game) return null;
  const turnSeat = seatsById[game.turnPlayerId];
  const canDraw = myTurn && !game.drawnCardId;

  let status;
  if (game.phase === 'ended') status = 'Match over';
  else if (myTurn && game.pendingDraw > 0) status = game.playable.length ? `Stack a ${valueName(game.pendingType)} or take +${game.pendingDraw}` : `No stack — take +${game.pendingDraw}`;
  else if (myTurn && game.drawnCardId) status = game.rules.forcePlay ? 'Force Play: you must play the drawn card' : 'Drew a match! Play it or pass';
  else if (myTurn) status = game.playable.length ? `Your turn — match ${game.currentColor} or ${valueName(game.top.value)}` : 'No match — draw a card';
  else status = `${turnSeat?.name?.replace(' 🤖', '') ?? '…'} is ${turnSeat?.isBot || turnSeat?.autopilot ? 'thinking' : 'playing'}…`;
  if (!myTurn && game.playable.length && game.rules.jumpIn) status = '⚡ Jump-In available — tap your glowing card!';

  const city = cityOf(room);
  const bet = Number(room.settings?.bet) || 0;
  const actionRow = (
    <>
            {coachOn && myTurn && (
              <button onClick={askHint} className="btn-ghost !py-2 text-sm" title="Smart Hint (H)">💡 Hint</button>
            )}
            {game.canPass && <button onClick={actions.pass} className="btn-ghost !py-2 text-sm">Pass ⏭</button>}
            {mode === 'online' && (
              <div className="relative">
                <button onClick={() => setEmotesOpen((o) => !o)} className={`btn-ghost !py-2 !px-3 text-lg ${emotesOpen ? '!bg-white/25' : ''}`} aria-label="Reactions">😊</button>
                <AnimatePresence>
                  {emotesOpen && (
                    <motion.div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                      onClick={() => setEmotesOpen(false)}>
                      <EmoteBar compact />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
    </>
  );
  const centerBlock = (
    <>
        <CenterPiles game={game} canDraw={canDraw} onDraw={actions.draw} lastPlayFrom={lastPlayFrom} />
        <motion.div key={status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className={`relative z-10 mt-9 px-4 py-1.5 rounded-full text-sm sm:text-base font-bold ${myTurn ? 'bg-gold text-felt-900 shadow-lg' : 'bg-black/30 text-white/85'}`}>
          {status}{myTurn && secsLeft != null && room.settings.turnSeconds ? <span className={`ml-2 inline-grid place-items-center min-w-7 h-6 px-1.5 rounded-full text-xs ${secsLeft <= 5 ? 'bg-uno-red text-white' : 'bg-black/20'}`}>{secsLeft}</span> : null}
        </motion.div>
    </>
  );

  return (
    <div className={`felt tbl h-full flex flex-col overflow-hidden ${wide ? 'tbl-wide' : ''} ${shaking ? 'shake' : ''}`}>
      <div className="tbl-scene" style={{ backgroundImage: `url(/ui/city/${city[0]}.webp)` }} aria-hidden />
      <TopBar onChat={() => setChatOpen((o) => !o)} unread={unread} voiceOn={voiceOn} setVoiceOn={setVoiceOn} listening={listening}
        coachOn={coachOn} setCoachOn={setCoachOn} tipsOn={tipsOn} setTipsOn={setTipsOn} />

      {wide ? (
        <div className="tbl-felt-wrap">
          <TableShape />
          <div className="tbl-panel ip">
            <div className="ip-city">{city[1].toUpperCase()}</div>
            <div className="ip-row"><span>PRIZE:</span><img className="ip-coins" src="/ui/coins.webp" alt="" /><b>{bet ? fmt(bet * game.players.length) : '—'}</b></div>
            <div className="ip-row"><span>BET:</span><b>{bet ? fmt(bet) : 'FREE'}</b></div>
            <div className="ip-end">PLAYERS<b>{game.players.length}</b></div>
          </div>
          <div className="tbl-panel sp">
            <div className="sp-title">PLAY</div>
            <motion.div key={game.direction} className="sp-dir" initial={{ rotate: game.direction === 1 ? -180 : 180 }} animate={{ rotate: 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 14 }} title={game.direction === 1 ? 'Play goes clockwise' : 'Play goes counter-clockwise'}>
              {game.direction === 1 ? '↻' : '↺'}
            </motion.div>
            <div className="sp-color"><i style={{ background: COLOR_HEX[game.currentColor] }} />{game.currentColor?.toUpperCase()}</div>
            <div className="sp-rules">{[['stacking', 'STACKING'], ['sevenZero', '7-0'], ['jumpIn', 'JUMP-IN'], ['forcePlay', 'FORCE PLAY']].filter(([k]) => game.rules?.[k]).map(([k, l]) => <span key={k}>{l}</span>)}</div>
          </div>
          {others.map(({ player, seat }, i) => (
            <div key={player.id} className={`tbl-seat pos-${SLOTS[Math.min(others.length, 5)][i] ?? 'top'}`}>
              <Opponent big seat={seat} player={player} isTurn={game.turnPlayerId === player.id}
                vulnerable={game.unoVulnerable === player.id && !spectator && game.phase === 'playing'}
                onCatch={() => actions.catchUno(player.id)} revealHand={spectator}
                timerPct={game.turnPlayerId === player.id ? timerPct : null} />
            </div>
          ))}
          <div className="tbl-center">{centerBlock}</div>
          {!spectator && (
            <div className="tbl-seat pos-me">
              <div className={`seat-ring rounded-full grid place-items-center ${myTurn ? 'my-turn' : ''}`}><Avatar k={seatsById[myId]?.avatar} size={84} /></div>
              <div className={`seat-name-me ${myTurn ? 'turn' : ''}`}>{(seatsById[myId]?.name || 'You').replace(' 🤖', '')} · {myCount}</div>
            </div>
          )}
          {!spectator && <div className="tbl-actions">{actionRow}</div>}
        </div>
      ) : (
        <>
      {/* Opponents */}
      <div className="relative z-10 flex justify-center gap-2 sm:gap-6 px-2 pt-1 flex-wrap">
        {others.map(({ player, seat }) => (
          <Opponent key={player.id} seat={seat} player={player} isTurn={game.turnPlayerId === player.id}
            vulnerable={game.unoVulnerable === player.id && !spectator && game.phase === 'playing'}
            onCatch={() => actions.catchUno(player.id)} revealHand={spectator}
            timerPct={game.turnPlayerId === player.id ? timerPct : null} />
        ))}
      </div>

      {/* Center */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[220px]">
        {centerBlock}
      </div>
        </>
      )}

      {/* My area */}
      {!spectator ? (
        <div className="relative z-20 pb-[max(8px,env(safe-area-inset-bottom))]">
          {/* Coach / tips: beside the table on wide screens, above the hand on phones */}
          <div className={wide ? 'tbl-coach' : 'px-3 mb-2 md:mb-0 md:fixed md:left-4 md:top-1/2 md:-translate-y-1/2 md:w-72 md:px-0 z-30'}>
            {hint?.tip ? <Coach tip={hint.tip} onClose={() => setHint(null)} /> : <TipBubble tip={tip} onClose={dismissTip} />}
          </div>
          {!wide && <div className="flex items-center justify-center gap-2 px-3 min-h-[40px]">
            <span className={`md:hidden chip ${myTurn ? 'bg-gold text-felt-900' : 'bg-black/40'}`}><Avatar k={seatsById[myId]?.avatar} size={20} className="inline-block align-middle" /> {myCount}</span>
            {coachOn && myTurn && (
              <button onClick={askHint} className="btn-ghost !py-2 text-sm" title="Smart Hint (H)">💡 Hint</button>
            )}
            {game.canPass && <button onClick={actions.pass} className="btn-ghost !py-2 text-sm">Pass ⏭</button>}
            {mode === 'online' && (
              <div className="relative">
                <button onClick={() => setEmotesOpen((o) => !o)} className={`btn-ghost !py-2 !px-3 text-lg ${emotesOpen ? '!bg-white/25' : ''}`} aria-label="Reactions">😊</button>
                <AnimatePresence>
                  {emotesOpen && (
                    <motion.div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                      onClick={() => setEmotesOpen(false)}>
                      <EmoteBar compact />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>}
          <div className="relative">
            {wide ? (
              null
            ) : (
            <div className="absolute left-3 top-5 z-10 hidden md:flex items-center gap-2">
              <div className={`relative w-11 h-11 rounded-full grid place-items-center text-2xl ${myTurn ? 'bg-gold/30 ring-4 ring-gold' : 'bg-white/10'}`}>
                <Avatar k={seatsById[myId]?.avatar} size={44} />
              </div>
              <span className="chip bg-black/40">{myCount}</span>
            </div>
            )}
            <Hand hand={game.hand} playable={game.playable} myTurn={myTurn} hintCardId={hint?.cardId} onPlay={handlePlay} disabled={game.phase !== 'playing'} />
          </div>

          {/* Ek! panic button */}
          <AnimatePresence>
            {showUno && game.phase === 'playing' && (
              <motion.button key="uno" onClick={doUno}
                initial={{ scale: 0, rotate: -30 }} animate={{ scale: [1, 1.1, 1], rotate: 0 }} exit={{ scale: 0, rotate: 30 }}
                transition={{ scale: { repeat: Infinity, duration: 0.8 }, rotate: { type: 'spring' } }}
                className="absolute right-3 -top-24 sm:right-8 sm:-top-28 z-30 w-24 h-24 sm:w-28 sm:h-28 rounded-full font-display font-bold text-3xl text-white pulse-ring"
                style={{ background: 'radial-gradient(circle at 35% 30%, #ff7b6b, #e53935 55%, #a31515)', boxShadow: '0 8px 0 #7a0f0f, 0 14px 30px rgba(0,0,0,.5)', WebkitTextStroke: '1.5px #5a0a0a' }}
                aria-label="Call Ek">
                EK!
                <span className="block text-[10px] font-sans font-bold tracking-wide opacity-90" style={{ WebkitTextStroke: 0 }}>
                  {voiceOn ? 'or shout it!' : vulnerableMe ? 'tap fast!' : 'press U'}
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="pb-4 flex flex-col items-center gap-2">
          <div className="glass rounded-2xl px-4 py-2 text-sm">👀 You're spectating{room.settings.spectatorsSeeHands ? ' — all hands are revealed' : ''}. Send reactions below!</div>
          <EmoteBar />
        </div>
      )}

      <ColorPicker open={!!pendingWild} suggested={pendingWild && hint?.cardId === pendingWild.id ? hint.color : undefined}
        onClose={() => setPendingWild(null)}
        onPick={(color) => { actions.playCard(pendingWild.id, { color }); setPendingWild(null); }} />
      <SwapPicker open={!!pendingSeven}
        players={others.map(({ player, seat }) => ({ id: player.id, name: seat.name, avatar: seat.avatar, cardCount: player.cardCount }))}
        onClose={() => setPendingSeven(null)}
        onPick={(id) => { actions.playCard(pendingSeven.id, { swapTargetId: id }); setPendingSeven(null); }} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <EmoteLayer seatPositions={seatPositions} />
      {room.phase === 'ended' && room.recap && <Recap />}
      <span className="sr-only" aria-live="polite">{status}{game.top ? `. Top card ${cardName(game.top)}` : ''}</span>
    </div>
  );
}
