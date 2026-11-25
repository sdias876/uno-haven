// Wires up the opening page, main menu, Mega Bonus wheel, gifts, stats, avatars and settings.
// Ported from Sequence Haven (which follows Spade Haven) and adapted to Ek Haven.
import { P, saveP, fmt, levelOf, lvBase, FREE_COINS, FREE_EVERY, SPIN_EVERY, DAILY, onWallet } from './wallet.js';
import { AVATARS, AV_NAMES, avatarUrl } from './avatars.js';
import { sound } from '../lib/sound.js';
import { prefs } from '../lib/socket.js';

const WHEEL_VALUES = [500, 2500, 750, 250, 1000, 250, 10000, 1500, 250, 1000, 2000, 500, 750, 250, 5000, 1000];
const WN = WHEEL_VALUES.length, WSEG = 360 / WN;
const wShort = (v) => (v >= 10000 ? `${v / 1000}K` : String(v));
const wRad = (d) => (d - 90) * Math.PI / 180;
const wPt = (r, d) => `${(r * Math.cos(wRad(d))).toFixed(2)} ${(r * Math.sin(wRad(d))).toFixed(2)}`;
const clockStr = (ms) => { const t = Math.ceil(ms / 1000); return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((n) => String(n).padStart(2, '0')).join(':'); };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function wheelArt(px, rotClass) {
  const VB = '-200 -214 400 414', id = (n) => `${px}-${n}`;
  const fill = (i, v) => (v >= 10000 ? id('red') : i % 4 === 0 ? id('gold') : i % 4 === 2 ? id('cream') : id('dark'));
  const ink = (i, v) => (v >= 10000 ? '#fff4e0' : i % 4 === 0 ? '#3a2400' : i % 4 === 2 ? '#2a2a2e' : '#e9ecf8');
  let h = `<div class="mw-art" role="img" aria-label="Mega bonus prize wheel"><svg class="mw-layer mw-back" viewBox="${VB}" aria-hidden="true"><defs>
    <linearGradient id="${id('gold')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".5" stop-color="#f2b632"/><stop offset="1" stop-color="#b77a0c"/></linearGradient>
    <linearGradient id="${id('cream')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf2"/><stop offset="1" stop-color="#d9d3bd"/></linearGradient>
    <linearGradient id="${id('dark')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a4d5c"/><stop offset="1" stop-color="#1f2129"/></linearGradient>
    <linearGradient id="${id('red')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a5a"/><stop offset=".55" stop-color="#d91a2a"/><stop offset="1" stop-color="#8a0614"/></linearGradient>
    <linearGradient id="${id('chrome')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".25" stop-color="#b9c2e0"/><stop offset=".5" stop-color="#6b7499"/><stop offset=".75" stop-color="#d9def0"/><stop offset="1" stop-color="#59618a"/></linearGradient>
    <radialGradient id="${id('bulb')}"><stop offset="0" stop-color="#fff7d6"/><stop offset=".45" stop-color="#ffb53d"/><stop offset="1" stop-color="#c45a00"/></radialGradient>
    <radialGradient id="${id('shine')}" cx=".5" cy=".2" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id('ptr')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaf4ff"/><stop offset="1" stop-color="#7fb6ff"/></linearGradient>
    </defs><circle r="198" fill="none" stroke="#3fb4ff" stroke-width="4" class="mw-neon"/><circle r="192" fill="url(#${id('chrome')})"/><circle r="176" fill="#141626"/></svg>`;
  for (const g of [0, 1]) {
    h += `<svg class="mw-layer mw-bulbs g${g}" viewBox="${VB}" aria-hidden="true">`;
    for (let j = 0; j < 16; j++) { const [x, y] = wPt(184, (j * 2 + g) * 11.25).split(' '); h += `<circle cx="${x}" cy="${y}" r="5.6" fill="url(#${id('bulb')})"/>`; }
    h += '</svg>';
  }
  h += `<div class="mw-layer mw-rot ${rotClass || ''}"><svg viewBox="${VB}" aria-hidden="true">`;
  WHEEL_VALUES.forEach((v, i) => {
    const a0 = i * WSEG - WSEG / 2, a1 = a0 + WSEG, mid = i * WSEG, [tx, ty] = wPt(112, mid).split(' ');
    h += `<g data-i="${i}"><path d="M0 0 L${wPt(170, a0)} A170 170 0 0 1 ${wPt(170, a1)} Z" fill="url(#${fill(i, v)})" stroke="#0d0e18" stroke-width="2"/><text x="${tx}" y="${ty}" fill="${ink(i, v)}" font-size="${v >= 10000 ? 30 : 34}" font-family="Bebas Neue, Impact, sans-serif" letter-spacing="1" text-anchor="middle" dominant-baseline="central" transform="rotate(${mid + 90} ${tx} ${ty})">${wShort(v)}</text></g>`;
  });
  WHEEL_VALUES.forEach((_, i) => { const [x, y] = wPt(162, i * WSEG - WSEG / 2).split(' '); h += `<circle cx="${x}" cy="${y}" r="4.5" fill="url(#${id('chrome')})" stroke="#0d0e18"/>`; });
  h += `<circle r="170" fill="url(#${id('shine')})" pointer-events="none"/></svg></div>`;
  h += `<svg class="mw-layer mw-front" viewBox="${VB}" aria-hidden="true"><circle r="62" fill="url(#${id('chrome')})"/><circle r="54" fill="#1b1340"/>`;
  for (let i = 0; i < 8; i++) { const [x, y] = wPt(58, i * 45 + 22.5).split(' '); h += `<circle cx="${x}" cy="${y}" r="4.4" fill="#ffd34d" stroke="#7a5200" stroke-width="1"/>`; }
  h += `<g class="mw-pointer"><path d="M-24 -206 L24 -206 L0 -156 Z" fill="url(#${id('ptr')})" stroke="#173a80" stroke-width="3" stroke-linejoin="round"/>`;
  for (let k = 0; k < 3; k++) h += `<path d="M-9 ${-200 + k * 11} L0 ${-192 + k * 11} L9 ${-200 + k * 11}" fill="none" stroke="#ff3fa4" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" class="mw-chev c${k}"/>`;
  return h + '</g></svg></div>';
}

// tiny synth for the wheel ticks and coin sounds (respects the game's mute)
let actx = null;
function tone(freqs, dur = 0.12, type = 'sine', vol = 0.08) {
  if (sound.isMuted()) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * dur * 0.8;
      o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    });
  } catch { /* no audio */ }
}
const sfx = { coin: () => tone([880, 1320], 0.09, 'triangle'), win: () => tone([523, 659, 784, 1047], 0.13, 'triangle'), big: () => tone([784, 988, 1175, 1568], 0.16, 'square', 0.05) };

/**
 * Mount the shell into `root`. `api` = { getProfile, setProfile, quickPlay({levels,bet}), createRoom(), joinRoom(code),
 * openTutorial(), installState(), install(), connected(), startView }.
 * Returns a cleanup function.
 */
export function mountShell(root, api) {
  const $ = (id) => root.querySelector(`#${id}`);
  const all = (sel) => root.querySelectorAll(sel);
  const timers = [];
  const every = (fn, ms) => timers.push(setInterval(fn, ms));
  const unsubs = [];

  // ---- toast ----
  let toastT;
  const toast = (msg, err = false, ms = 2600) => {
    const t = $('shToast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
  };

  // ---- screens ----
  const show = (id) => {
    $('home').hidden = id !== 'home'; $('menu').hidden = id !== 'menu';
    window.scrollTo(0, 0);
    if (id === 'menu') { const m = $('menu'); m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter'); fitMenu(); updateBonus(); renderWallet(); }
  };
  const goPlay = () => {
    show('menu');
    try { history.replaceState(null, '', location.pathname + location.search + '#play'); } catch { /* ignore */ }
    if (!$('nameIn').value.trim()) setTimeout(() => $('nameIn').focus({ preventScroll: true }), 200);
  };
  const toLanding = () => { show('home'); try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ } };
  all('[data-play]').forEach((b) => b.addEventListener('click', goPlay));
  all('[data-rules-open]').forEach((b) => b.addEventListener('click', () => { $('rulesOv').hidden = false; }));

  // ---- menu scales to fill the window on computers, like Spade Haven ----
  function fitMenu() {
    const st = $('mStage'); if (!st) return;
    if (innerWidth <= 900) { st.style.transform = ''; st.style.width = ''; st.style.height = ''; return; }
    const k = Math.min(innerHeight / 820, innerWidth / 1500);
    st.style.width = `${innerWidth / k}px`; st.style.height = `${innerHeight / k}px`; st.style.transform = `scale(${k})`;
  }
  addEventListener('resize', fitMenu);

  // ---- segmented pickers ----
  const segVal = (id) => $(id).querySelector('.on').dataset.v;
  all('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  }));

  // ---- name + avatar ----
  const prof = () => api.getProfile();
  $('nameIn').value = prof().name || '';
  $('nameIn').addEventListener('input', (e) => api.setProfile({ ...prof(), name: e.target.value.slice(0, 16) }));
  const myAvatar = () => { const a = prof().avatar; return AVATARS.includes(a) ? a : null; };
  if (!myAvatar()) api.setProfile({ ...prof(), avatar: AVATARS[Math.floor(Math.random() * 32)] });
  const mAvatar = () => { $('mAvatar').style.backgroundImage = `url(${avatarUrl(myAvatar())})`; };
  mAvatar();
  $('mAvatar').onclick = () => {
    const g = $('avGrid'); g.innerHTML = '';
    AVATARS.forEach((k) => {
      const b = document.createElement('button'); b.className = `av-pick${k === myAvatar() ? ' on' : ''}`;
      b.innerHTML = `<span style="background-image:url(${avatarUrl(k)})"></span>${AV_NAMES[k] && AV_NAMES[k] !== 'Player' ? `<small>${AV_NAMES[k]}</small>` : ''}`;
      b.onclick = () => { api.setProfile({ ...prof(), avatar: k }); mAvatar(); $('avatarOv').hidden = true; toast('Picture changed!', false, 1400); };
      g.appendChild(b);
    });
    $('avatarOv').hidden = false;
  };
  const needName = () => {
    if ($('nameIn').value.trim()) return false;
    $('nameIn').focus(); toast('Type your name first 🙂'); return true;
  };

  // ---- wallet ----
  let shownCoins = P.coins;
  function renderWallet() {
    const el = $('mCoins'); if (!el) return;
    const from = shownCoins, to = P.coins; shownCoins = to;
    if (from !== to) {
      const t0 = performance.now(), d = 900;
      const step = (t) => { const k = Math.min(1, (t - t0) / d); el.textContent = fmt(from + (to - from) * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
      const pill = el.parentElement; pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
    } else el.textContent = fmt(to);
    const L = levelOf(P.xp), lo = lvBase(L), hi = lvBase(L + 1);
    $('mLv').textContent = L; $('mLvFill').style.width = `${Math.round(100 * (P.xp - lo) / (hi - lo))}%`;
    updateSoloWin();
  }
  unsubs.push(onWallet(renderWallet));
  function coinBurst(fromEl, n = 12) {
    const target = $('mCoins'); if (!target || $('menu').hidden) return;
    const a = fromEl.getBoundingClientRect(), b = target.parentElement.querySelector('.coin').getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const c = document.createElement('span'); c.className = 'coin'; c.textContent = '★';
      c.style.left = `${a.left + a.width / 2 - 17 + (Math.random() - 0.5) * 80}px`; c.style.top = `${a.top + a.height / 2 - 17 + (Math.random() - 0.5) * 60}px`;
      $('coinFly').appendChild(c);
      setTimeout(() => { c.style.transform = `translate(${b.left - parseFloat(c.style.left)}px, ${b.top - parseFloat(c.style.top)}px) scale(.7)`; c.style.opacity = '.2'; }, 30 + i * 45);
      setTimeout(() => c.remove(), 1100 + i * 45);
    }
  }
  const gainCoins = (n, fromEl) => { P.coins += n; if (fromEl) { coinBurst(fromEl); setTimeout(saveP, 700); } else saveP(); };

  // ---- Play Now: bots, players and bet ----
  const soloBet = () => Number(segVal('soloBet'));
  function updateSoloWin() {
    const el = $('soloWin'); if (!el) return;
    const players = Number(segVal('soloSize')) + 1, b = soloBet();
    el.textContent = P.coins >= b ? `Win ${fmt(b * players)} coins` : `You need ${fmt(b)} coins for this bet`;
    el.style.color = P.coins >= b ? '' : '#ff9aa6';
  }
  ['soloBet', 'soloSize'].forEach((id) => $(id).addEventListener('click', () => setTimeout(updateSoloWin, 0)));
  const savedLevel = prefs.get('mode', 'smart');
  $('soloLevel').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === savedLevel));
  if (!$('soloLevel').querySelector('.on')) $('soloLevel').firstElementChild.classList.add('on');
  function needCoins(b) {
    if (P.coins >= b) return false;
    toast(`You need ${fmt(b)} coins. Grab your free coins, gifts or a spin!`, true, 3500);
    $('soloOv').hidden = true; openGifts(); return true;
  }
  const levelsFor = (lvl, n) => Array.from({ length: n }, (_, i) => (lvl === 'tactical' && i === n - 1 && n > 1 ? 'casual' : lvl));
  let busy = false;
  const run = async (fn) => { if (busy) return; busy = true; try { await fn(); } finally { busy = false; } };
  $('btnSolo').onclick = () => {
    if (needName()) return;
    const bet = soloBet(); if (needCoins(bet)) return;
    const lvl = segVal('soloLevel'); prefs.set('mode', lvl);
    $('soloOv').hidden = true;
    run(() => api.quickPlay({ levels: levelsFor(lvl, Number(segVal('soloSize'))), bet }));
  };
  $('mPlay').onclick = () => { updateSoloWin(); $('soloOv').hidden = false; };
  $('mQuick').onclick = () => {
    if (needName()) return;
    const b = P.coins >= 500 ? 500 : P.coins >= 100 ? 100 : 0;
    if (!b) { needCoins(100); return; }
    run(() => api.quickPlay({ levels: ['smart', 'smart', 'smart'], bet: b }));
  };
  const friends = () => {
    if (needName()) return;
    if (!api.connected()) { toast('Waking up the game server… try again in a moment.', true, 3500); return; }
    run(() => api.createRoom());
  };
  $('mFriends').onclick = friends; $('mInvite').onclick = friends; $('mInvite2').onclick = friends;
  const openJoin = (code = '') => {
    $('codeIn').value = code;
    $('joinNote').textContent = code ? 'You were invited to this table.' : '';
    $('joinOv').hidden = false; setTimeout(() => $('codeIn').focus(), 50);
  };
  $('mJoin').onclick = () => openJoin();
  $('codeIn').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
  $('btnJoin').onclick = () => {
    if (needName()) return;
    const code = $('codeIn').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) { toast('Table codes have 5 letters or numbers.', true); return; }
    if (!api.connected()) { toast('Waking up the game server… try again in a moment.', true, 3500); return; }
    $('joinOv').hidden = true;
    run(() => api.joinRoom(code));
  };

  // ---- free coins every hour ----
  const freeLeft = () => Math.max(0, P.lastFree + FREE_EVERY - Date.now());
  $('mFree').onclick = () => {
    const left = freeLeft();
    if (left) { toast(`More free coins in ${clockStr(left)}`); return; }
    P.lastFree = Date.now(); gainCoins(FREE_COINS, $('mFree')); sfx.coin(); toast(`+${FREE_COINS} free coins!`);
  };

  // ---- daily gifts ----
  const today = () => new Date().toDateString();
  const yesterday = () => new Date(Date.now() - 864e5).toDateString();
  const giftReady = () => P.lastDaily !== today();
  const giftDay = () => (giftReady() ? (P.lastDaily === yesterday() ? P.streak % 7 : 0) : (P.streak - 1) % 7);
  function openGifts() {
    const box = $('giftDays'); box.innerHTML = '';
    const cur = giftDay(), ready = giftReady();
    DAILY.forEach((amt, i) => {
      const d = document.createElement('div');
      d.className = `day${i < cur || (!ready && i === cur) ? ' got' : ''}${ready && i === cur ? ' now' : ''}`;
      d.innerHTML = `<small>DAY ${i + 1}</small><img src="/ui/${i === 6 ? 'gift' : 'coins'}.webp" alt=""><b>${fmt(amt)}</b>`;
      box.appendChild(d);
    });
    $('giftClaim').disabled = !ready;
    $('giftClaim').textContent = ready ? `Collect ${fmt(DAILY[cur])}` : 'Collected today';
    $('giftNext').textContent = ready ? '' : 'Come back tomorrow for the next gift!';
    $('giftOv').hidden = false;
  }
  $('giftClaim').onclick = () => {
    if (!giftReady()) return;
    const day = giftDay(); P.streak = day + 1; P.lastDaily = today();
    gainCoins(DAILY[day], $('mGifts')); sfx.win(); toast(`Day ${day + 1} gift: +${fmt(DAILY[day])} coins!`);
    openGifts();
  };
  $('mGifts').onclick = openGifts; $('mPlus').onclick = openGifts;

  // ---- stats ----
  $('mStats').onclick = $('mLevel').onclick = () => {
    const nm = $('nameIn').value.trim();
    $('statsName').textContent = nm ? `${nm}'s Stats` : 'Your Stats';
    const rate = P.played ? `${Math.round(100 * P.won / P.played)}%` : '-';
    $('statsGrid').innerHTML = [[levelOf(P.xp), 'Level'], [fmt(P.coins), 'Coins'], [P.played, 'Games played'], [P.won, 'Games won'], [rate, 'Win rate'], [fmt(P.bestWin), 'Biggest win'], [P.spins, 'Wheel spins'], [fmt(P.bestSpin), 'Best spin']]
      .map(([v, k]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    $('statsOv').hidden = false;
  };

  // ---- Mega Bonus wheel ----
  $('mwArt').outerHTML = wheelArt('mw');
  $('wheelPeek').innerHTML = wheelArt('pk', 'mega-peek-rot');
  const spinLeft = () => Math.max(0, P.lastSpin + SPIN_EVERY - Date.now());
  let wAngle = 0, wPhase = 'idle', wDrift = 0;
  const wRot = () => $('mwWheel').querySelector('.mw-rot');
  const setPhase = (ph) => { wPhase = ph; const w = $('mwWheel'); w.classList.remove('idle', 'spinning', 'won'); w.classList.add(ph); };
  function mwHead() {
    const left = spinLeft();
    $('mwHead').innerHTML = left ? `NEXT SPIN IN <b>${clockStr(left)}</b>` : 'MEGA BONUS';
    $('mwWheel').classList.toggle('locked', !!left);
    $('spinGo').disabled = !!left || wPhase !== 'idle';
    $('mwHubTxt').textContent = wPhase === 'won' ? 'WIN!' : left ? 'SOON' : 'SPIN';
    $('mwCta').hidden = !!left || wPhase !== 'idle';
  }
  function drift() {
    cancelAnimationFrame(wDrift);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let last = performance.now();
    const step = (t) => { if ($('spinOv').hidden || wPhase !== 'idle') return; wAngle += (t - last) / 1000 * 4; last = t; wRot().style.transform = `rotate(${wAngle}deg)`; wDrift = requestAnimationFrame(step); };
    wDrift = requestAnimationFrame(step);
  }
  function openSpin() {
    setPhase('idle'); $('mwWon').hidden = true; $('mwHead').style.visibility = ''; $('mwCollect').hidden = true; $('mwCoins').innerHTML = '';
    $('mwWheel').querySelectorAll('.mw-win').forEach((g) => g.classList.remove('mw-win'));
    $('mwClose').hidden = false; mwHead(); $('spinOv').hidden = false; drift();
  }
  const closeSpin = () => { if (wPhase === 'spinning') return; $('spinOv').hidden = true; cancelAnimationFrame(wDrift); };
  $('mSpin').onclick = openSpin; $('mwClose').onclick = closeSpin; $('mwDim').onclick = closeSpin;
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    if (!$('spinOv').hidden) closeSpin();
    all('.overlay:not([hidden])').forEach((o) => { o.hidden = true; });
  };
  document.addEventListener('keydown', onKey);
  $('spinGo').onclick = () => {
    if (wPhase !== 'idle' || spinLeft()) return;
    const i = Math.floor(Math.random() * WN), from = wAngle, jitter = (Math.random() - 0.5) * WSEG * 0.6;
    const base = from - (((from % 360) + 360) % 360), to = base + 360 * 7 + ((360 - i * WSEG) % 360) + jitter;
    const dur = 5600, t0 = performance.now(), ease = (x) => 1 - (1 - x) ** 4;
    let lastSeg = Math.floor((from + WSEG / 2) / WSEG);
    P.lastSpin = Date.now(); saveP();
    setPhase('spinning'); $('mwClose').hidden = true; mwHead();
    const ptr = $('mwWheel').querySelector('.mw-pointer');
    const frame = (t) => {
      const k = Math.min(1, (t - t0) / dur), a = from + (to - from) * ease(k);
      wAngle = a; wRot().style.transform = `rotate(${a}deg)`;
      const sg = Math.floor((a + WSEG / 2) / WSEG);
      if (sg !== lastSeg) {
        lastSeg = sg; tone([1100], 0.025, 'square', 0.02);
        if (ptr?.animate) ptr.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-14deg)', offset: 0.35 }, { transform: 'rotate(0deg)' }], { duration: 140, easing: 'ease-out' });
      }
      if (k < 1) { requestAnimationFrame(frame); return; }
      const prize = WHEEL_VALUES[i];
      setPhase('won'); $('mwClose').hidden = false; mwHead();
      $('mwWheel').querySelector(`.mw-rot g[data-i="${i}"]`)?.classList.add('mw-win');
      $('mwHead').style.visibility = 'hidden'; $('mwAmt').textContent = fmt(prize); $('mwWon').hidden = false; $('mwCollect').hidden = false;
      let c = '';
      for (let k2 = 0; k2 < 22; k2++) { const an = k2 / 22 * Math.PI * 2 + Math.random() * 0.3, d = 140 + Math.random() * 220; c += `<span style="--dx:${Math.cos(an) * d}px;--dy:${Math.sin(an) * d - 80}px;--dl:${Math.random() * 0.35}s;--sp:${(Math.random() - 0.5) * 720}deg"><i class="coin">★</i></span>`; }
      $('mwCoins').innerHTML = c;
      P.spins++; P.bestSpin = Math.max(P.bestSpin, prize); P.coins += prize;
      try { localStorage.setItem('unohaven.wallet', JSON.stringify(P)); } catch { /* ignore */ }
      sfx.win(); if (prize >= 5000) setTimeout(sfx.big, 500);
    };
    requestAnimationFrame(frame);
  };
  $('mwCollect').onclick = () => { $('spinOv').hidden = true; setPhase('idle'); coinBurst($('mSpin'), 16); setTimeout(() => { saveP(); updateBonus(); }, 700); };
  every(() => { if (!$('spinOv').hidden && wPhase === 'idle') mwHead(); }, 1000);
  function updateBonus() {
    if ($('menu').hidden) return;
    const left = spinLeft();
    $('mSpin').classList.toggle('waiting', !!left);
    $('bonusTimer').hidden = !left; $('spinTag').hidden = !!left;
    if (left) { $('bonusClock').textContent = clockStr(left); $('bonusFill').style.width = `${100 * (1 - left / SPIN_EVERY)}%`; }
    const fl = freeLeft(), tag = $('freeTag');
    tag.textContent = fl ? clockStr(fl).slice(3) : 'FREE'; tag.classList.toggle('ready', !fl);
    $('giftBadge').hidden = !giftReady();
  }
  every(updateBonus, 1000);

  // ---- settings ----
  const OPT = {
    sound: [() => !sound.isMuted(), (v) => sound.setMuted(!v)],
    coach: [() => prefs.get('coach', true), (v) => prefs.set('coach', v)],
    tips: [() => prefs.get('tips', true), (v) => prefs.set('tips', v)],
    voice: [() => prefs.get('voice', false), (v) => prefs.set('voice', v)],
  };
  function renderSettings() {
    all('#setOv .tg').forEach((t) => {
      const on = OPT[t.dataset.k][0]();
      t.classList.toggle('on', on); t.setAttribute('aria-checked', on); t.querySelector('.tg-txt').textContent = on ? 'ON' : 'OFF';
    });
    $('acctLine').innerHTML = `Playing as <b>${esc($('nameIn').value.trim() || 'Player')}</b> on this device.`;
    const ins = api.installState();
    $('setInstall').hidden = !ins.canInstall; $('installHint').hidden = !ins.iosHint;
  }
  $('mGear').onclick = () => { renderSettings(); $('setOv').hidden = false; };
  all('#setOv .tg').forEach((t) => { t.onclick = () => { const [get, set] = OPT[t.dataset.k]; set(!get()); if (t.dataset.k === 'sound' && get()) sfx.coin(); renderSettings(); }; });
  $('setExit').onclick = () => { $('setOv').hidden = true; toLanding(); };
  $('setInstall').onclick = () => api.install();
  $('setTips').onclick = () => { $('setOv').hidden = true; api.openTutorial(); };
  $('mLearn').onclick = () => api.openTutorial();

  // ---- rules + promo ----
  const rulesOpen = () => { $('rulesOv').hidden = false; };
  $('mHelp').onclick = rulesOpen; $('mRules').onclick = rulesOpen;
  const PROMOS = [['MEGA BONUS', 'Spin the wheel for up to 10,000 coins!'], ['DAILY GIFTS', 'Come back every day for bigger gifts!'], ['TAKE THE POT', 'Win a game to take everyone\'s bet!']];
  let promoI = 0;
  $('mPromo').onclick = () => { [openSpin, openGifts, () => $('mPlay').click()][promoI](); };
  every(() => {
    if ($('menu').hidden) return;
    promoI = (promoI + 1) % PROMOS.length;
    const pt = $('promoText'); pt.classList.remove('swap'); void pt.offsetWidth; pt.classList.add('swap');
    $('promoTitle').textContent = PROMOS[promoI][0]; $('promoSub').textContent = PROMOS[promoI][1];
    [...$('promoDots').children].forEach((d, i) => d.classList.toggle('on', i === promoI));
  }, 4000);

  // ---- closing pop-ups ----
  all('[data-close]').forEach((b) => b.addEventListener('click', () => { b.closest('.overlay').hidden = true; }));
  all('.overlay').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o) o.hidden = true; }));

  // ---- start ----
  const invited = new URLSearchParams(location.search).get('room');
  renderWallet();
  if (invited) { show('menu'); openJoin(invited.toUpperCase().slice(0, 5)); }
  else if (api.startView === 'menu' || location.hash === '#play') show('menu');
  else show('home');

  return () => {
    timers.forEach(clearInterval); unsubs.forEach((u) => u());
    removeEventListener('resize', fitMenu); document.removeEventListener('keydown', onKey);
    cancelAnimationFrame(wDrift); clearTimeout(toastT);
  };
}
