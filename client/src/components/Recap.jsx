import { motion } from 'framer-motion';
import { useGame } from '../lib/store.jsx';
import { Card } from './Card.jsx';
import { resultFor, fmt } from '../shell/wallet.js';

const via = { wild4: 'a Wild Draw Four', draw2: 'a Draw Two', catch: 'an Ek catch' };

function Stat({ icon, label, value, sub, delay }) {
  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: { delay } }}
      className="rounded-2xl bg-white/7 border border-white/10 p-3">
      <div className="text-2xl">{icon}</div>
      <div className="text-xs text-white/55 mt-1">{label}</div>
      <div className="font-display text-lg leading-tight">{value}</div>
      {sub && <div className="text-xs text-white/60">{sub}</div>}
    </motion.div>
  );
}

export function Recap() {
  const { room, me, game, actions } = useGame();
  const r = room.recap;
  const isHost = me?.isHost;
  const iWon = r.winnerId === me?.id;
  const voted = room.rematchVotes.includes(me?.id);
  const h = r.highlights;
  const coins = resultFor(room);
  const players = r.players.slice().sort((a, b) => a.cardsLeft - b.cardsLeft);

  return (
    <motion.div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {iWon && <Confetti />}
      <motion.div className="glass rounded-3xl w-full max-w-4xl max-h-[94vh] overflow-y-auto sm:overflow-hidden scrollbar-thin p-4 sm:p-6 flex flex-col sm:flex-row gap-5"
        initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
        {/* Result and buttons: always on screen */}
        <div className="sm:w-72 shrink-0 flex flex-col items-center justify-center">
        <div className="text-center">
          <img src={iWon ? '/ui/go-win.webp' : '/ui/go-lose.webp'} alt="" className="w-20 h-20 sm:w-28 sm:h-28 mx-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,.5)]" />
          <h2 className="font-display text-3xl sm:text-4xl">{iWon ? 'You win!' : `${r.winnerName.replace(' 🤖', '')} wins!`}</h2>
          <p className="text-white/70 mt-1">{r.score} points in {r.totalTurns} turns</p>
          {coins?.bet > 0 && (
            <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-5 py-1.5 font-bebas text-3xl tracking-[2px] bg-black/40 border-2 ${coins.net > 0 ? 'text-[#ffd75e] border-[#ffc83d]/70' : 'text-[#ff9aa6] border-[#ff5a6e]/60'}`}>
              <span className="grid place-items-center w-9 h-9 rounded-full text-lg text-[#8a5200] bg-[radial-gradient(circle_at_38%_30%,#fff4c2,#ffd75e_35%,#e09a00_75%,#a86a00)] shadow-[0_0_0_2px_#6b4306]">★</span>
              {coins.net > 0 ? `+${fmt(coins.net)} coins` : `−${fmt(-coins.net)} coins`}
            </div>
          )}
          {room.botTrend && (
            <p className="mt-2 inline-block chip bg-white/10 !text-sm">
              {room.botTrend === 'up' ? '📈 Auto bots will play a little tougher next round' : '📉 Auto bots will ease off a little next round'}
            </p>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2 w-full">
          {me?.role === 'player' && (
            <button onClick={actions.rematch} disabled={voted && !isHost} className="btn-gold text-lg !py-2.5 w-full">
              🔁 {isHost ? 'Rematch with same group' : voted ? 'Waiting for host…' : 'Vote rematch'}
            </button>
          )}
          {isHost && <button onClick={actions.backToLobby} className="btn-ghost w-full">⚙️ Change rules / seats</button>}
          <button onClick={actions.leave} className="btn-ghost w-full">Leave table</button>
        </div>
        </div>
        {/* Match details: scroll inside if a big table needs it */}
        <div className="flex-1 min-w-0 sm:min-h-0 sm:overflow-y-auto scrollbar-thin sm:pr-1">
        <h3 className="font-display text-gold text-xl mb-2">Smart Match Recap</h3>
        <div className="grid grid-cols-3 gap-2">
          <Stat delay={0.1} icon="😈" label="Most ruthless move"
            value={h.mostRuthless ? `${h.mostRuthless.by.replace(' 🤖', '')} → ${h.mostRuthless.victim.replace(' 🤖', '')}` : 'Peaceful game'}
            sub={h.mostRuthless ? `+${h.mostRuthless.amount} via ${via[h.mostRuthless.via] ?? h.mostRuthless.via}` : 'No penalties dealt'} />
          <Stat delay={0.18} icon="🔥" label="Longest Ek streak"
            value={h.longestUnoStreak ? h.longestUnoStreak.name.replace(' 🤖', '') : '—'}
            sub={h.longestUnoStreak ? `${h.longestUnoStreak.turns} turn${h.longestUnoStreak.turns > 1 ? 's' : ''} on one card` : 'Nobody sat on one card'} />
          <Stat delay={0.26} icon="⚡" label="Fastest hands"
            value={h.fastest ? h.fastest.name.replace(' 🤖', '') : '—'}
            sub={h.fastest ? `${(h.fastest.avgTurnMs / 1000).toFixed(1)}s per turn` : ''} />
        </div>

        <div className="mt-3 rounded-2xl overflow-hidden border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/60 text-xs">
              <tr><th className="text-left px-2 py-1.5">Player</th><th className="px-2 py-1.5">Left</th><th className="px-2 py-1.5">Played</th><th className="px-2 py-1.5">Drew</th><th className="px-2 py-1.5 hidden sm:table-cell">Actions</th><th className="px-2 py-1.5 hidden sm:table-cell">Catches</th><th className="px-2 py-1.5">Avg turn</th></tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className={`border-t border-white/5 ${p.id === me?.id ? 'bg-gold/10' : ''}`}>
                  <td className="px-2 py-1.5 font-bold">{p.id === r.winnerId ? '👑 ' : ''}{p.name}</td>
                  <td className="px-2 py-1.5 text-center">{p.cardsLeft}</td>
                  <td className="px-2 py-1.5 text-center">{p.cardsPlayed}</td>
                  <td className="px-2 py-1.5 text-center">{p.cardsDrawn}</td>
                  <td className="px-2 py-1.5 text-center hidden sm:table-cell">{p.actionCards + p.wildsPlayed}</td>
                  <td className="px-2 py-1.5 text-center hidden sm:table-cell">{p.caughtOthers}</td>
                  <td className="px-2 py-1.5 text-center">{p.avgTurnMs ? `${(p.avgTurnMs / 1000).toFixed(1)}s` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {game?.players?.some((p) => p.hand?.length) && (
          <div className="mt-3">
            <div className="text-sm text-white/60 mb-1">Cards left in hands</div>
            <div className="space-y-1.5">
              {game.players.filter((p) => p.hand?.length).map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-xs w-20 truncate">{p.name}</span>
                  <div className="flex -space-x-4">{p.hand.map((c) => <Card key={c.id} card={c} size="xs" />)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-white/70 font-bold">Replay timeline (last {r.timeline.length} moves)</summary>
          <ol className="mt-2 space-y-0.5 max-h-32 overflow-y-auto scrollbar-thin text-white/75 text-xs">
            {r.timeline.map((e, i) => (
              <li key={i}>
                <span className="text-white/40 mr-2">T{e.turn}</span>
                <b>{e.name}</b>{' '}
                {e.type === 'play' && <>played <b>{e.label}</b>{e.card?.color === 'wild' ? ` → ${e.color}` : ''}{e.jumpedIn ? ' (jump-in!)' : ''}</>}
                {e.type === 'penalty' && <>drew {e.amount} as a penalty</>}
                {e.type === 'caught' && <>got caught without calling Ek</>}
                {e.type === 'uno' && <>called EK!</>}
                {e.type === 'swap' && <>swapped hands</>}
                {e.type === 'rotate' && <>rotated all hands</>}
                {e.type === 'win' && <>won the round 🎉</>}
              </li>
            ))}
          </ol>
        </details>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Confetti() {
  const colors = ['#e53935', '#fbc02d', '#43a047', '#1e88e5', '#f5c451'];
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {Array.from({ length: 60 }).map((_, i) => (
        <motion.span key={i} className="absolute w-2.5 h-4 rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, top: -20, background: colors[i % colors.length] }}
          animate={{ y: ['0vh', '110vh'], rotate: [0, 360 * (i % 2 ? 1 : -1) * 2], x: [0, ((i % 7) - 3) * 30] }}
          transition={{ duration: 2.5 + (i % 5) * 0.4, delay: (i % 10) * 0.12, ease: 'easeIn', repeat: 1 }} />
      ))}
    </div>
  );
}
