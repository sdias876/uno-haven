import { AnimatePresence, motion } from 'framer-motion';
import { GameProvider, useGame } from './lib/store.jsx';
import { Home } from './components/Home.jsx';
import { Lobby } from './components/Lobby.jsx';
import { Table } from './components/Table.jsx';
import { Banners, Toasts } from './components/Social.jsx';

function Screen() {
  const { room, game, connected } = useGame();
  const view = !room ? 'home' : room.phase === 'lobby' || !game ? 'lobby' : 'table';
  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={view} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {view === 'home' && <Home />}
          {view === 'lobby' && <Lobby />}
          {view === 'table' && <Table />}
        </motion.div>
      </AnimatePresence>
      {room && !connected && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 chip bg-amber-500 text-black !text-sm !px-4 !py-2 shadow-xl">
          Reconnecting… your seat is saved for 60s
        </div>
      )}
      <Toasts />
      <Banners />
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      <Screen />
    </GameProvider>
  );
}
