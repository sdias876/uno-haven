import { AnimatePresence, motion } from 'framer-motion';
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

function TopBar({ onChat, chatOpen, voiceOn, setVoiceOn, listening }) {
  const { room, actions, toast } = useGame();
  const [muted, setMuted] = useMuted();
  const invite = async () => {
    const url = `${window.location.origin}/?room=${room.code}`;
    try {
      if (navigator.share && /Mobi/i.test(navigator.userAgent)) await navigator.share({ title: 'Join my UNO table', url });
      else { await navigator.clipboard.writeText(url); toast('Invite link copied!', 'good'); }
    } catch { /* cancelled */ }
  };
  return (
    <header className="relative z-30 flex items-center gap-2 px-3 py-2">
      <div className="font-display text-xl sm:text-2xl font-bold tracking-wide">
        <span className="text-uno-red">U</span><span className="text-uno-yellow">N</span><span className="text-uno-green">O</span>
        <span className="text-white/80 text-base sm:text-lg ml-1">Haven</span>
      </div>
      <button onClick={invite} className="chip bg-white/10 hover:bg-white/20 ml-1 font-mono tracking-widest" title="Copy invite link">
        {room.code} 🔗
      </button>
      {room.spectators.length > 0 && <span className="chip bg-white/10" title={room.spectators.map((s) => s.name).join(', ')}>👀 {room.spectators.length}</span>}
      <div className="ml-auto flex items-center gap-1.5">
        {voiceSupported && (
          <button onClick={() => setVoiceOn(!voiceOn)} className={`btn-ghost !px-2.5 !py-1.5 ${voiceOn ? '!bg-emerald-500/30' : ''}`}
            title="Say “UNO!” out loud">
            {voiceOn ? (listening ? '🎙️' : '🎤') : '🎤'}<span className="hidden sm:inline text-sm">{voiceOn ? 'Listening' : 'Voice'}</span>
          </button>
        )}
        <button onClick={() => setMuted(!muted)} className="btn-ghost !px-2.5 !py-1.5" aria-label="Toggle sound">{muted ? '🔇' : '🔊'}</button>
        <button onClick={onChat} className={`btn-ghost !px-2.5 !py-1.5 ${chatOpen ? '!bg-white/25' : ''}`} aria-label="Chat">💬</button>
        <button onClick={() => { if (confirm('Leave this table?')) actions.leave(); }} className="btn-ghost !px-2.5 !py-1.5" aria-label="Leave">🚪</button>
      </div>
    </header>
  );
}

function Opponent({ seat, player, isTurn, vulnerable, onCatch, revealHand, timerPct }) {
  const count = player?.cardCount ?? 0;
  const shown = Math.min(count, 8);
  return (
    <motion.div layout className="flex flex-col items-center gap-1 min-w-[78px]">
      <div className="relative">
        {isTurn && timerPct != null && (
          <svg className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] -rotate-90" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="27" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" />
            <circle cx="30" cy="30" r="27" fill="none" stroke={timerPct < 0.3 ? '#ff5252' : '#f5c451'} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${170 * timerPct} 170`} />
          </svg>
        )}
        <motion.div animate={isTurn ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ repeat: isTurn ? Infinity : 0, duration: 1.4 }}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full grid place-items-center text-2xl sm:text-3xl ${isTurn ? 'bg-gold/30 ring-4 ring-gold' : 'bg-white/10'} ${!seat.connected ? 'opacity-50' : ''}`}>
          {seat.avatar}
        </motion.div>
        {seat.autopilot && <span className="absolute -bottom-1 -right-1 chip bg-sky-500 !px-1.5 !py-0.5 text-[10px]" title="Autopilot">🤖</span>}
        {count === 1 && !vulnerable && <span className="absolute -top-2 -right-3 chip bg-uno-red text-white text-[10px] rotate-12">UNO</span>}
      </div>
      <div className="text-xs sm:text-sm font-bold max-w-[96px] truncate">{seat.name}</div>
      {revealHand && player?.hand ? (
        <div className="flex -space-x-8 max-w-[220px] overflow-hidden">
          {player.hand.slice(0, 10).map((c) => <Card key={c.id} card={c} size="sm" />)}
        </div>
      ) : (
        <div className="relative h-[56px] flex items-end justify-center" style={{ width: 36 + shown * 10 }}>
          {Array.from({ length: shown }).map((_, i) => (
            <Card key={i} faceDown size="xs" className="!absolute bottom-0" style={{ left: i * 10, transform: `rotate(${(i - shown / 2) * 4}deg)`, width: 36, height: 52, fontSize: 5.5 }} />
          ))}
        </div>
      )}
      <span className="chip bg-black/40">{count} card{count === 1 ? '' : 's'}</span>
      <AnimatePresence>
        {vulnerable && (
          <motion.button initial={{ scale: 0 }} animate={{ scale: [1, 1.12, 1] }} exit={{ scale: 0 }} transition={{ repeat: Infinity, duration: 0.7 }}
            onClick={onCatch} className="btn !py-1 !px-3 bg-rose-600 text-white text-sm shadow-lg">Catch! 🚨</motion.button>
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
      {/* Direction ring + active color */}
      <motion.div className="absolute rounded-full pointer-events-none"
        animate={{ rotate: game.direction === 1 ? 360 : -360 }} transition={{ repeat: Infinity, duration: 14, ease: 'linear' }}
        style={{ width: ring, height: ring, border: `3px dashed ${COLOR_HEX[game.currentColor]}66` }}>
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl" style={{ color: COLOR_HEX[game.currentColor] }}>{game.direction === 1 ? '➤' : '◀'}</span>
      </motion.div>
      <div className="absolute rounded-full blur-3xl opacity-35 pointer-events-none transition-colors duration-500"
        style={{ width: ring * 0.8, height: ring * 0.8, background: COLOR_HEX[game.currentColor] }} />

      {/* Draw pile */}
      <motion.button onClick={onDraw} disabled={!canDraw} whileHover={canDraw ? { y: -4, rotate: -2 } : {}} whileTap={canDraw ? { scale: 0.94 } : {}}
        className={`relative ${canDraw ? 'cursor-pointer' : 'cursor-default'}`} aria-label="Draw a card">
        {[2, 1, 0].map((i) => (
          <Card key={i} faceDown size={pw} className={i ? '!absolute' : ''} style={{ top: -i * 2, left: -i * 2 }} />
        ))}
        {canDraw && <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs font-bold text-gold whitespace-nowrap animate-pulse">
          {game.pendingDraw > 0 ? `Take +${game.pendingDraw}` : 'Tap to draw'}
        </span>}
        <span className="absolute -top-2 -right-2 chip bg-black/60 text-[10px]">{game.drawCount}</span>
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

export function Table() {
  const { room, game, me, actions, shake, lastFx } = useGame();
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingWild, setPendingWild] = useState(null);
  const [pendingSeven, setPendingSeven] = useState(null);
  const [hint, setHint] = useState(null);
  const [coachOn, setCoachOn] = useState(() => prefs.get('coach', true));
  const [voiceOn, setVoiceOn] = useState(() => prefs.get('voice', false));
  const [shaking, setShaking] = useState(false);

  useEffect(() => { prefs.set('coach', coachOn); }, [coachOn]);
  useEffect(() => { prefs.set('voice', voiceOn); }, [voiceOn]);
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

  return (
    <div className={`felt h-full flex flex-col overflow-hidden ${shaking ? 'shake' : ''}`}>
      <TopBar onChat={() => setChatOpen((o) => !o)} chatOpen={chatOpen} voiceOn={voiceOn} setVoiceOn={setVoiceOn} listening={listening} />

      {/* Opponents */}
      <div className="flex justify-center gap-2 sm:gap-6 px-2 pt-1 flex-wrap">
        {others.map(({ player, seat }) => (
          <Opponent key={player.id} seat={seat} player={player} isTurn={game.turnPlayerId === player.id}
            vulnerable={game.unoVulnerable === player.id && !spectator && game.phase === 'playing'}
            onCatch={() => actions.catchUno(player.id)} revealHand={spectator}
            timerPct={game.turnPlayerId === player.id ? timerPct : null} />
        ))}
      </div>

      {/* Center */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[220px]">
        <CenterPiles game={game} canDraw={canDraw} onDraw={actions.draw} lastPlayFrom={lastPlayFrom} />
        <motion.div key={status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className={`mt-12 px-4 py-1.5 rounded-full text-sm sm:text-base font-bold ${myTurn ? 'bg-gold text-felt-900 shadow-lg' : 'bg-black/30 text-white/85'}`}>
          {status}{myTurn && secsLeft != null && room.settings.turnSeconds ? ` · ${secsLeft}s` : ''}
        </motion.div>
      </div>

      {/* My area */}
      {!spectator ? (
        <div className="relative pb-[max(8px,env(safe-area-inset-bottom))]">
          <div className="px-3 mb-2"><Coach tip={hint?.tip} onClose={() => setHint(null)} /></div>
          <div className="flex items-center justify-center gap-2 px-3 flex-wrap">
            {coachOn && game.phase === 'playing' && (
              <button onClick={askHint} className="btn-ghost !py-2 text-sm" title="Smart Hint (H)">💡 Smart Hint</button>
            )}
            {game.canPass && <button onClick={actions.pass} className="btn-ghost !py-2 text-sm">Pass ⏭</button>}
            {canDraw && game.playable.length > 0 && game.pendingDraw === 0 && (
              <button onClick={actions.draw} className="btn-ghost !py-2 text-sm">Draw 🂠</button>
            )}
            <span className={`md:hidden chip ${myTurn ? 'bg-gold text-felt-900' : 'bg-black/40'}`}>{seatsById[myId]?.avatar} {myCount}</span>
            <button onClick={() => setCoachOn(!coachOn)} className="btn-ghost !py-2 !px-2.5 text-xs opacity-70" title="Toggle Smart Coach">
              {coachOn ? 'Coach on' : 'Coach off'}
            </button>
            <div className="hidden sm:block"><EmoteBar compact /></div>
          </div>
          <div className="relative">
            <div className="absolute left-3 top-5 z-10 hidden md:flex items-center gap-2">
              <div className={`relative w-11 h-11 rounded-full grid place-items-center text-2xl ${myTurn ? 'bg-gold/30 ring-4 ring-gold' : 'bg-white/10'}`}>
                {seatsById[myId]?.avatar}
              </div>
              <span className="chip bg-black/40">{myCount}</span>
            </div>
            <Hand hand={game.hand} playable={game.playable} myTurn={myTurn} hintCardId={hint?.cardId} onPlay={handlePlay} disabled={game.phase !== 'playing'} />
          </div>
          <div className="sm:hidden flex justify-center pb-1"><EmoteBar compact /></div>

          {/* UNO panic button */}
          <AnimatePresence>
            {showUno && game.phase === 'playing' && (
              <motion.button key="uno" onClick={doUno}
                initial={{ scale: 0, rotate: -30 }} animate={{ scale: [1, 1.1, 1], rotate: 0 }} exit={{ scale: 0, rotate: 30 }}
                transition={{ scale: { repeat: Infinity, duration: 0.8 }, rotate: { type: 'spring' } }}
                className="absolute right-3 -top-24 sm:right-8 sm:-top-28 z-30 w-24 h-24 sm:w-28 sm:h-28 rounded-full font-display font-bold text-3xl text-white pulse-ring"
                style={{ background: 'radial-gradient(circle at 35% 30%, #ff7b6b, #e53935 55%, #a31515)', boxShadow: '0 8px 0 #7a0f0f, 0 14px 30px rgba(0,0,0,.5)', WebkitTextStroke: '1.5px #5a0a0a' }}
                aria-label="Call UNO">
                UNO!
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
