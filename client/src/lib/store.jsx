import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { net, send, session, prefs } from './socket.js';
import { play, say } from './sound.js';
import { settleBets } from '../shell/wallet.js';

const Ctx = createContext(null);
export const useGame = () => useContext(Ctx);

let uid = 0;
const nid = () => `${Date.now()}_${uid++}`;

export function GameProvider({ children }) {
  const [connected, setConnected] = useState(net.connected);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  const [mode, setMode] = useState(net.mode); // 'online' | 'local'
  const [room, setRoom] = useState(null);
  const [game, setGame] = useState(null);
  const [me, setMe] = useState(null);
  const [chat, setChat] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [banners, setBanners] = useState([]); // big center callouts
  const [emotes, setEmotes] = useState([]);
  const [shake, setShake] = useState(0);
  const [lastFx, setLastFx] = useState([]);
  const [profile, setProfileState] = useState(() => prefs.get('profile', { name: '', avatar: `a${1 + Math.floor(Math.random() * 32)}` }));
  const stateRef = useRef({});
  stateRef.current = { room, game, me };

  const setProfile = useCallback((p) => { setProfileState(p); prefs.set('profile', p); }, []);

  const toastRef = useRef(null);
  const toast = useCallback((text, tone = 'info') => {
    const id = nid();
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  toastRef.current = toast;
  const banner = useCallback((text, color = 'gold') => {
    const id = nid();
    setBanners((b) => [...b.slice(-1), { id, text, color }]);
    setTimeout(() => setBanners((b) => b.filter((x) => x.id !== id)), 1400);
  }, []);

  const nameOf = useCallback((pid) => {
    const s = stateRef.current.room?.seats.find((x) => x.id === pid);
    return s ? (pid === stateRef.current.me?.id ? 'You' : s.name.replace(' 🤖', '')) : 'Someone';
  }, []);

  // ---- socket wiring ----
  useEffect(() => {
    const onConnect = async () => {
      setConnected(true);
      if (net.mode !== 'online') return;
      const s = session.get();
      if (s?.code) {
        const res = await send('room:join', { code: s.code, token: s.token, name: s.name, avatar: s.avatar });
        if (res.error) { session.clear(); setRoom(null); setGame(null); }
        else {
          session.set({ ...s, token: res.token ?? s.token });
          if (res.chat) setChat(res.chat);
        }
      }
    };
    const onDisconnect = () => setConnected(false);
    const onState = ({ room, game, me }) => {
      const prev = stateRef.current;
      if (game && me?.id && game.turnPlayerId === me.id && prev.game?.turnPlayerId !== me.id && game.phase === 'playing') play('turn');
      setRoom(room); setGame(game); setMe(me);
      settleBets(room, me, toastRef.current);
      // Remember how strong the adaptive bots got, so the next solo game starts there
      if (room?.phase === 'ended' && typeof room.botStrength === 'number' && room.botTrend) prefs.set('skill', room.botStrength);
    };
    const onChat = (msg) => setChat((c) => [...c.slice(-79), msg]);
    const onEmote = (e) => {
      setEmotes((list) => [...list.slice(-12), { ...e, key: nid() }]);
      play('pop');
      setTimeout(() => setEmotes((list) => list.filter((x) => x.id !== e.id)), 2600);
    };
    const onFx = (events) => {
      setLastFx(events);
      const myId = stateRef.current.me?.id;
      for (const e of events) {
        switch (e.type) {
          case 'deal': play('shuffle'); setTimeout(() => play('deal'), 350); break;
          case 'play':
            if (e.card.value === 'wild4') { play('plus4'); setShake((n) => n + 1); banner('+4!', 'red'); }
            else if (e.card.value === 'draw2') { play('plus2'); }
            else play('snap');
            break;
          case 'draw': play('draw'); break;
          case 'penalty':
            if (e.amount >= 4) setShake((n) => n + 1);
            if (e.playerId === myId) toast(`You drew ${e.amount} cards`, 'bad');
            break;
          case 'stack': banner(`Stack +${e.total}!`, 'red'); break;
          case 'skip': play('skip'); if (e.playerId === myId) banner('Skipped!', 'blue'); break;
          case 'reverse': play('reverse'); banner('Reverse!', 'green'); break;
          case 'swap': play('swap'); banner('Hands swapped!', 'yellow'); break;
          case 'rotate': play('swap'); banner('Hands rotate!', 'yellow'); break;
          case 'jumpIn': play('snap'); banner(`${nameOf(e.playerId)} jumped in!`, 'yellow'); break;
          case 'uno': play('uno'); say('UNO!'); banner(`${nameOf(e.playerId)}: UNO!`, 'gold'); break;
          case 'unoReady': if (e.playerId === myId) toast("UNO armed — play your card!", 'good'); break;
          case 'caught': play('caught'); toast(`${nameOf(e.by)} caught ${nameOf(e.playerId)}! +2`, 'bad'); break;
          case 'takeover': toast(e.playerId === myId ? '⏱️ Time! Smart autopilot played for you' : `🤖 Autopilot is covering for ${nameOf(e.playerId)}`, 'info'); break;
          case 'reconnected': toast(`${nameOf(e.playerId)} reconnected`, 'good'); break;
          case 'win': play('win'); break;
          default:
        }
      }
    };
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    net.on('connect', onConnect);
    net.on('disconnect', onDisconnect);
    net.on('room:state', onState);
    net.on('social:chat', onChat);
    net.on('social:emote', onEmote);
    net.on('game:fx', onFx);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (net.connected) onConnect();
    return () => {
      net.off('connect', onConnect); net.off('disconnect', onDisconnect);
      net.off('room:state', onState); net.off('social:chat', onChat);
      net.off('social:emote', onEmote); net.off('game:fx', onFx);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [banner, toast, nameOf]);

  // ---- actions ----
  const act = useCallback(async (event, payload) => {
    const res = await send(event, payload);
    if (res.error) { toast(res.error, 'bad'); play('error'); }
    return res;
  }, [toast]);

  const actions = useMemo(() => ({
    async createRoom() {
      if (net.mode !== 'online') { net.useOnline(); setMode('online'); setConnected(net.connected); }
      const res = await act('room:create', profile);
      if (!res.error) { session.set({ code: res.code, token: res.token, ...profile }); setChat(res.chat ?? []); }
      return res;
    },
    async joinRoom(code) {
      if (net.mode !== 'online') { net.useOnline(); setMode('online'); setConnected(net.connected); }
      const res = await act('room:join', { code: code.trim().toUpperCase(), ...profile });
      if (!res.error) { session.set({ code: res.code, token: res.token ?? null, ...profile }); setChat(res.chat ?? []); }
      return res;
    },
    /** Solo vs bots runs entirely in this browser: instant start, works offline. */
    async quickPlay(levels = ['smart', 'smart', 'smart'], rules, { bet = 0 } = {}) {
      await net.useLocal();
      setMode('local'); setConnected(true);
      const res = await act('room:create', { ...profile, skill: prefs.get('skill', 0.45) });
      if (res.error) return res;
      setChat(res.chat ?? []);
      for (const level of levels) await send('lobby:addBot', { level });
      await send('lobby:rules', { rules: rules ?? {}, settings: { bet } });
      return act('lobby:start');
    },
    async leave() {
      await send('room:leave');
      if (net.mode === 'local') { net.useOnline(); setMode('online'); setConnected(net.connected); }
      session.clear();
      setRoom(null); setGame(null); setMe(null); setChat([]);
      const url = new URL(window.location.href); url.searchParams.delete('room');
      window.history.replaceState({}, '', url);
    },
    addBot: (level) => act('lobby:addBot', { level }),
    removeSeat: (playerId) => act('lobby:removeSeat', { playerId }),
    botLevel: (playerId, level) => act('lobby:botLevel', { playerId, level }),
    setRules: (rules, settings) => act('lobby:rules', { rules, settings }),
    start: () => act('lobby:start'),
    takeSeat: async () => {
      const res = await act('lobby:takeSeat');
      if (!res.error) { const s = session.get(); session.set({ ...s, token: res.token }); }
      return res;
    },
    backToLobby: () => act('lobby:backToLobby'),
    playCard: (cardId, opts = {}) => act('game:play', { cardId, ...opts }),
    draw: () => act('game:draw'),
    pass: () => act('game:pass'),
    uno: () => act('game:uno'),
    catchUno: (targetId) => act('game:catch', { targetId }),
    hint: () => send('game:hint'),
    rematch: () => act('game:rematch'),
    chat: (text) => act('social:chat', { text }),
    emote: (emoji) => send('social:emote', { emoji }),
  }), [act, profile]);

  const value = { connected, offline, mode, room, game, me, chat, toasts, banners, emotes, shake, lastFx, profile, setProfile, actions, toast, nameOf };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
