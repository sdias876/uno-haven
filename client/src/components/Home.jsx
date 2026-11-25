import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../lib/store.jsx';
import { prefs } from '../lib/socket.js';
import { useInstall } from '../lib/install.js';
import { Card } from './Card.jsx';
import { Tutorial } from './Tutorial.jsx';
import { OnlineLobby } from './OnlineLobby.jsx';
import { SHELL_HTML } from '../shell/markup.js';
import { mountShell } from '../shell/shell.js';
import '../shell/shell.css';

const heroCards = [
  { id: 'h1', color: 'red', value: '7' }, { id: 'h2', color: 'yellow', value: 'skip' },
  { id: 'h3', color: 'wild', value: 'wild4' }, { id: 'h4', color: 'green', value: 'reverse' }, { id: 'h5', color: 'blue', value: 'draw2' },
];

// Players coming back from a table land on the main menu, not the opening page.
let visited = false;

/** Opening page + main menu in the Spade Haven family look (see src/shell). */
export function Home() {
  const game = useGame();
  const ref = useRef(null);
  const live = useRef(game);
  live.current = game;
  const install = useInstall();
  const installRef = useRef(install);
  installRef.current = install;
  const [fan, setFan] = useState(null);
  const [lobby, setLobby] = useState(false);
  const shellApi = useRef(null);
  const [tutorial, setTutorial] = useState(() => !prefs.get('tutorialDone', false) && !new URLSearchParams(location.search).get('room'));

  useEffect(() => {
    const root = ref.current;
    root.innerHTML = SHELL_HTML;
    setFan(root.querySelector('#heroFan'));
    const startView = visited ? 'menu' : 'home';
    visited = true;
    const g = () => live.current;
    return mountShell(root, {
      openLobby: () => setLobby(true),
      ready: (h) => { shellApi.current = h; },
      startView,
      getProfile: () => prefs.get('profile', g().profile),
      setProfile: (p) => g().setProfile(p),
      connected: () => g().connected && !g().offline,
      quickPlay: ({ levels, bet }) => g().actions.quickPlay(levels, undefined, { bet }),
      createRoom: () => g().actions.createRoom(),
      joinRoom: (code) => g().actions.joinRoom(code),
      openTutorial: () => setTutorial(true),
      installState: () => installRef.current,
      install: () => installRef.current.install(),
    });
  }, []);

  return (
    <div className="sh h-full overflow-y-auto">
      <div ref={ref} />
      {fan && createPortal(heroCards.map((c) => <div key={c.id} className="fc"><Card card={c} size={104} /></div>), fan)}
      {lobby && <OnlineLobby onClose={() => setLobby(false)} onNeedCoins={(b) => { setLobby(false); shellApi.current?.needCoins(b); }} />}
      {tutorial && (
        <Tutorial
          onSkip={() => { setTutorial(false); prefs.set('tutorialDone', true); }}
          onDone={() => { setTutorial(false); prefs.set('tutorialDone', true); }}
        />
      )}
    </div>
  );
}
