// Ek Haven's opening page, main menu and pop-ups, built like Spade Haven / Sequence Haven.
const STAR = 'M0 -6 L1.8 -1.8 6 -1.8 2.6 1 3.8 5.6 0 3 -3.8 5.6 -2.6 1 -6 -1.8 -1.8 -1.8Z';

/** The Ek Haven emblem: gold rim, navy disc, two fanned cards and gold stars. */
export function emblem(n, cls = 'emb') {
  const card = (x, rot, grad, inner) => `<g transform="rotate(${rot} 120 140)"><rect x="${x}" y="58" width="64" height="94" rx="9" fill="#fff"/><rect x="${x + 4}" y="62" width="56" height="86" rx="7" fill="url(#${grad}${n})"/>
    <ellipse cx="${x + 32}" cy="105" rx="21" ry="33" transform="rotate(28 ${x + 32} 105)" fill="#fff"/>${inner}</g>`;
  return `<svg class="${cls}" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ek Haven">
<defs>
<linearGradient id="eg${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cc"/><stop offset=".4" stop-color="#ffc83d"/><stop offset=".8" stop-color="#d48f0c"/><stop offset="1" stop-color="#a86d08"/></linearGradient>
<linearGradient id="er${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cc"/><stop offset=".3" stop-color="#f5c240"/><stop offset=".65" stop-color="#b87a0a"/><stop offset="1" stop-color="#ffd970"/></linearGradient>
<radialGradient id="en${n}" cx=".5" cy=".32" r=".75"><stop offset="0" stop-color="#4a5ee8"/><stop offset=".6" stop-color="#1f2a9c"/><stop offset="1" stop-color="#0b0f45"/></radialGradient>
<linearGradient id="cr${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a5d"/><stop offset=".5" stop-color="#e5383b"/><stop offset="1" stop-color="#b3191c"/></linearGradient>
<linearGradient id="cb${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a9bff"/><stop offset=".5" stop-color="#2d7ff9"/><stop offset="1" stop-color="#1652b8"/></linearGradient>
<filter id="es${n}"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".55"/></filter>
</defs>
<circle cx="120" cy="128" r="112" fill="#6b4306"/>
<circle cx="120" cy="120" r="112" fill="url(#er${n})"/>
<circle cx="120" cy="120" r="101" fill="#5a3a05"/>
<circle cx="120" cy="120" r="99" fill="url(#en${n})"/>
<path d="M34 96 A90 90 0 0 1 206 96" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="6" stroke-linecap="round"/>
<g filter="url(#es${n})">
${card(62, -16, 'cb', `<text x="94" y="118" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-weight="900" font-size="38" fill="#2d7ff9" stroke="#151a36" stroke-width="2.5" paint-order="stroke">7</text>`)}
${card(114, 14, 'cr', `<text x="146" y="114" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-weight="900" font-size="32" fill="#e5383b" stroke="#151a36" stroke-width="2.5" paint-order="stroke" transform="rotate(-18 146 110)">EK</text>`)}
</g>
<g filter="url(#es${n})">
<circle cx="120" cy="176" r="26" fill="url(#en${n})" stroke="#ffc83d" stroke-width="4"/>
<path transform="translate(120 176) scale(2.2)" d="${STAR}" fill="url(#eg${n})" stroke="#fff6d6" stroke-width=".4"/>
</g>
<path transform="translate(120 23) scale(1.25)" d="${STAR}" fill="url(#eg${n})" stroke="#fff6d6" stroke-width=".4"/>
<path transform="translate(95 30) scale(.8)" d="${STAR}" fill="url(#eg${n})" stroke="#fff6d6" stroke-width=".4"/>
<path transform="translate(145 30) scale(.8)" d="${STAR}" fill="url(#eg${n})" stroke="#fff6d6" stroke-width=".4"/>
</svg>`;
}

const ring = (cls, id, img, label, extra = '', wrap = '') => `<button class="ring-btn ${cls}" id="${id}"><span class="ring"><span class="ring-bolt b0">★</span><span class="ring-bolt b1">♥</span><span class="ring-bolt b2">♦</span><span class="ring-inner"><i class="rp r0"></i><i class="rp r1"></i><i class="rp r2"></i><span class="ri-wrap ${wrap}"><img class="ring-img" src="/ui/${img}.webp" alt=""><i class="ri-shine"></i></span>${extra}<i class="sp s0">✦</i><i class="sp s1">✦</i><i class="sp s2">✦</i></span></span><span class="ring-label">${label}</span></button>`;

const orbit = `<span class="orbit">${[['red', '+2'], ['yellow', '⊘'], ['green', '⇄'], ['blue', '7']]
  .map(([c, v], i) => `<b class="oc uc ${c}" style="--a:${i * 90}deg"><i class="uo"><i>${v}</i></i></b>`).join('')}</span>`;

const miniTable = `<div class="mini-uno">
  <div class="mt-opp o1"><i class="mb"></i><i class="mb"></i><i class="mb"></i><i class="mb"></i></div>
  <div class="mt-opp o2"><i class="mb"></i><i class="mb"></i><i class="mb"></i></div>
  <div class="mt-opp o3"><i class="mb"></i><i class="mb"></i><i class="mb"></i><i class="mb"></i><i class="mb"></i></div>
  <div class="mt-oval"><div class="mt-piles"><i class="mb big"></i><i class="mc red big">7</i><span class="mt-ring"></span></div></div>
  <div class="mt-hand"><i class="mc blue">2</i><i class="mc green">⇄</i><i class="mc yellow">9</i><i class="mc red">+2</i><i class="mc wild">W</i></div>
</div>`;

export const SHELL_HTML = `
<section class="screen landing" id="home">
  <nav class="land-nav">
    <a href="#top" class="land-brand">${emblem(9)}<span>EK HAVEN</span></a>
    <div class="land-links"><a href="#features">Features</a><button class="linklike" data-play>Game modes</button><button class="linklike" data-rules-open>Rules</button></div>
    <button class="pill green nav-cta" data-play>Play free</button>
  </nav>
  <header class="hero felt-bg" id="top">
    <div class="hero-copy">
      <div class="hero-logo">${emblem(1)}<div class="logo-name"><span>EK</span><span>HAVEN</span></div></div>
      <p class="hero-tag">Match the color or the number, hit them with a +4, and call EK! when you're down to one card. Smart bots, friends online and a coach at your side.</p>
      <div class="hero-ctas"><button class="pill green big" data-play>&#9654; Play in your browser</button></div>
      <p class="hero-fine">Free to play · No sign-up needed · Phones, tablets and computers</p>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="device"><div class="device-screen">${miniTable}</div></div>
      <div class="fan" id="heroFan"></div>
    </div>
  </header>
  <section class="land-section" id="features">
    <h2 class="sec-title">Everything at the table</h2>
    <div class="feature-grid">
      <article class="feature"><span class="f-icon">🤖</span><h3>Bots that adapt</h3><p>Chill, Classic and Ruthless bots, or Auto bots that get tougher when you win and ease off when you lose.</p></article>
      <article class="feature"><span class="f-icon">🔑</span><h3>Private tables</h3><p>Open a table, send the invite link or 5-letter code, and play friends on their own phones or computers.</p></article>
      <article class="feature"><span class="f-icon">👥</span><h3>Up to 6 players</h3><p>Fill empty seats with bots, and let friends watch as spectators when the table is full.</p></article>
      <article class="feature"><span class="f-icon">🃏</span><h3>House rules</h3><p>Stacking, the 7-0 swap, Jump-In and Force Play. Pick the rules your family plays with.</p></article>
      <article class="feature"><span class="f-icon">💡</span><h3>Smart Coach</h3><p>A one-line tip shows the best card and why, and you can say "Ek!" out loud to call it.</p></article>
      <article class="feature"><span class="f-icon">📶</span><h3>Never lose your seat</h3><p>Lost connection? Reopen the link and you are back in your seat. Solo games even work offline.</p></article>
    </div>
    <div class="center-row"><button class="pill green big" data-play>&#9654; Start playing now</button></div>
  </section>
  <footer class="land-foot">
    <span>&#9733; Ek Haven</span>
    <span>From the makers of Spade Haven · SE Digital Transformation</span>
    <span class="land-legal"><a href="/privacy">Privacy</a> · <a href="https://sedigitaltransformation.com/terms.html">Terms</a> · <a href="https://sedigitaltransformation.com/#contact">Contact</a></span>
  </footer>
</section>

<section class="screen menu" id="menu" hidden>
 <div class="lobby-aurora" aria-hidden="true"><i class="au1"></i><i class="au2"></i><i class="au3"></i><i class="au4"></i><i class="au-curtain"></i></div>
 <div class="m-stage" id="mStage">
  <header class="m-top">
    <button class="m-avatar" id="mAvatar" title="Change your picture" aria-label="Change your picture"><i class="m-av-edit">✎</i></button>
    <label class="m-name"><span class="m-name-lbl">Your name</span><input id="nameIn" maxlength="16" placeholder="Type your name" autocomplete="nickname"><span class="m-pen" aria-hidden="true">✎</span></label>
    <div class="coins-pill" title="Your coins"><span class="coin">★</span><b id="mCoins">50,000</b><button class="plus-btn" id="mPlus" title="Get free coins" aria-label="Get free coins">+</button></div>
    <button class="m-quick" id="mQuick"><i class="knob l"></i>QUICK GAME<i class="knob r"></i></button>
    <button class="level-pill" id="mLevel" title="Your level and stats"><span class="lv-star">★</span><span class="lv-txt">LEVEL <b id="mLv">1</b></span><i class="lv-bar"><i id="mLvFill"></i></i></button>
    <span class="m-sp"></span>
    <button class="m-round help" id="mHelp" title="How to play" aria-label="How to play">?</button>
    <button class="m-gear" id="mGear" title="Settings" aria-label="Settings"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="gg" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff4c2"/><stop offset=".4" stop-color="#f5c84a"/><stop offset=".8" stop-color="#b47a0c"/><stop offset="1" stop-color="#8a5806"/></radialGradient></defs><g class="gg-rot"><path fill="url(#gg)" stroke="#6b4306" stroke-width="2" d="M43 4h14l2 12a35 35 0 0 1 9 4l10-7 10 10-7 10a35 35 0 0 1 4 9l12 2v14l-12 2a35 35 0 0 1-4 9l7 10-10 10-10-7a35 35 0 0 1-9 4l-2 12H43l-2-12a35 35 0 0 1-9-4l-10 7-10-10 7-10a35 35 0 0 1-4-9L3 57V43l12-2a35 35 0 0 1 4-9l-7-10 10-10 10 7a35 35 0 0 1 9-4z"/><circle cx="50" cy="50" r="17" fill="#1b1340" stroke="#6b4306" stroke-width="3"/></g></svg></button>
  </header>
  <main class="m-main">
    <div class="m-left">
      <button class="promo" id="mPromo" aria-label="Mega bonus"><span class="promo-sparkles"><i style="left:12%;top:14%">✦</i><i style="left:84%;top:22%;animation-delay:.7s">✦</i><i style="left:20%;top:62%;animation-delay:1.3s">✦</i><i style="left:78%;top:70%;animation-delay:.4s">✦</i><i style="left:50%;top:8%;animation-delay:1.8s">✦</i></span>
        <img class="promo-img" src="/ui/crown.webp" alt="">
        <span class="promo-text" id="promoText"><span class="promo-title" id="promoTitle">MEGA BONUS</span>
        <span class="promo-sub" id="promoSub">Spin the wheel for up to 10,000 coins!</span></span>
        <span class="pdots" id="promoDots"><i class="on"></i><i></i><i></i></span>
      </button>
      <div class="m-chips">
        <button class="m-chip red" id="mFree"><img src="/ui/coins.webp" alt=""><b>+250</b><small>COINS</small><span class="free-tag" id="freeTag">FREE</span></button>
        <button class="m-chip purple" id="mLearn"><span class="aa">🎓</span><b>LEARN</b><small>TO PLAY</small></button>
        <button class="m-chip green" id="mInvite"><img src="/ui/invite.webp" alt=""><b>INVITE</b><small>FRIENDS</small></button>
      </div>
    </div>
    <div class="m-rings">
      ${ring('green', 'mPlay', 'play', 'PLAY NOW')}
      ${ring('blue', 'mFriends', 'globe', 'ONLINE LOBBY', orbit)}
      ${ring('purple', 'mJoin', 'lock', 'JOIN A GAME', '', 'lockw').replace('</button>', '<span class="now-open">GOT A CODE?</span></button>')}
    </div>
  </main>
  <nav class="m-bottom">
    <button id="mStats"><img src="/ui/trophy.webp" alt=""><span>STATS</span></button>
    <button id="mRules"><img src="/ui/crown.webp" alt=""><span>RULES</span></button>
    <button class="m-center" id="mSpin" aria-label="Mega bonus wheel"><i class="mc-glow"></i>
      <span class="wheel-peek mega-peek" id="wheelPeek"></span>
      <span class="spin-tag" id="spinTag">SPIN!</span>
      <span class="bonus-timer" id="bonusTimer" hidden><span>MEGA BONUS IN <b id="bonusClock">00:00:00</b></span><i class="bonus-bar"><i id="bonusFill"></i></i></span>
    </button>
    <button id="mGifts"><img src="/ui/gift.webp" alt=""><span>GIFTS</span><i class="nbadge" id="giftBadge" hidden>1</i></button>
    <button id="mInvite2"><img src="/ui/invite.webp" alt=""><span>INVITE</span></button>
  </nav>
 </div>
</section>

<div class="overlay" id="soloOv" hidden>
  <div class="modal pick">
    <h2>Play vs Computer</h2>
    <p class="muted">Practice against the bots. Solo games run on your device, so they work offline too.</p>
    <span class="lbl">Bots</span>
    <div class="seg" id="soloLevel"><button data-v="smart" class="on">Auto</button><button data-v="casual">Chill</button><button data-v="tactical">Classic</button><button data-v="ruthless">Ruthless</button></div>
    <span class="lbl" style="margin-top:1rem">Players</span>
    <div class="seg sizes" id="soloSize"><button data-v="1"><img src="/ui/ek-mode-2.webp" alt="">1 vs 1</button><button data-v="2"><img src="/ui/ek-mode-3.webp" alt="">3 players</button><button data-v="3" class="on"><img src="/ui/ek-mode-4.webp" alt="">4 players</button></div>
    <span class="lbl" style="margin-top:1rem">Your bet</span>
    <div class="seg bets" id="soloBet"><button data-v="100">100</button><button data-v="500" class="on">500</button><button data-v="1000">1K</button><button data-v="2500">2.5K</button><button data-v="5000">5K</button><button data-v="10000">10K</button></div>
    <p class="win-line" id="soloWin"></p>
    <div class="modal-foot"><button class="btn" data-close>Cancel</button><button class="pill green" id="btnSolo">&#9654; Start game</button></div>
  </div>
</div>
<div class="overlay" id="joinOv" hidden>
  <div class="modal pick">
    <h2>Join a Game</h2>
    <p class="muted">Type the 5-letter code your friend sent you.</p>
    <input class="field code-field" id="codeIn" maxlength="5" placeholder="CODE" autocomplete="off" aria-label="Table code">
    <p class="muted small" id="joinNote"></p>
    <div class="modal-foot"><button class="btn" data-close>Cancel</button><button class="pill green" id="btnJoin">Join</button></div>
  </div>
</div>

<div class="mw-overlay" id="spinOv" hidden role="dialog" aria-modal="true" aria-label="Mega bonus wheel">
  <div class="mw-dim" id="mwDim"></div>
  <button class="mw-close" id="mwClose" aria-label="Close">×</button>
  <div class="mw-stage">
    <div class="mw-head" id="mwHead">MEGA BONUS</div>
    <div class="mw-won" id="mwWon" hidden role="status"><div class="mw-won-title">YOU WON</div><div class="mw-won-amt"><span class="coin">★</span><span id="mwAmt">0</span></div></div>
    <div class="mw-wheel idle" id="mwWheel"><span id="mwArt"></span>
      <button class="mw-hub" id="spinGo" aria-label="Spin the wheel"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 14 C36 32 18 42 18 58 C18 70 28 76 37 75 C42 74.5 46 72 48 69 C47 77 44 82 38 86 L62 86 C56 82 53 77 52 69 C54 72 58 74.5 63 75 C72 76 82 70 82 58 C82 42 64 32 50 14 Z" fill="currentColor"/></svg><span id="mwHubTxt">SPIN</span></button>
      <div class="mw-cta" id="mwCta" aria-hidden="true"><span class="mw-cta-click">Click</span><span class="mw-cta-to">TO SPIN</span><svg viewBox="0 0 120 60"><path d="M6 44 C40 44 62 34 92 16 M92 16 L74 14 M92 16 L86 33" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>
    <div class="mw-coins" id="mwCoins" aria-hidden="true"></div>
    <button class="mw-collect pill" id="mwCollect" hidden>COLLECT</button>
  </div>
</div>
<div class="overlay" id="giftOv" hidden>
  <div class="modal pick gifts">
    <h2>Daily Gifts</h2>
    <p class="muted">Come back every day. Your gift grows each day in a row.</p>
    <div class="days" id="giftDays"></div>
    <div class="modal-foot"><button class="btn" data-close>Close</button><button class="pill green" id="giftClaim">Collect</button></div>
    <p class="muted small" id="giftNext"></p>
  </div>
</div>
<div class="overlay" id="statsOv" hidden>
  <div class="modal pick stats">
    <img class="stats-trophy" src="/ui/trophy.webp" alt="">
    <h2 id="statsName">Your Stats</h2>
    <div class="stats-grid" id="statsGrid"></div>
    <p class="muted small">Coins and stats are saved on this device.</p>
    <div class="modal-foot"><button class="pill green" data-close>Close</button></div>
  </div>
</div>
<div class="overlay" id="avatarOv" hidden>
  <div class="modal pick avatars">
    <h2>Choose your picture</h2>
    <p class="muted">Everyone at your table will see it.</p>
    <div class="av-grid" id="avGrid"></div>
    <div class="modal-foot"><button class="btn" data-close>Close</button></div>
  </div>
</div>
<div class="overlay" id="setOv" hidden>
  <div class="modal settings">
    <button class="x-close" data-close aria-label="Close">×</button>
    <h2>Settings</h2>
    <div class="set-scroll">
      <div class="set-acct">
        <div class="set-left">
          <h3 id="acctTitle">Account</h3>
          <p class="acct-line" id="acctLine"></p>
          <button class="exit-btn" id="setExit">EXIT</button>
          <small class="exit-note" id="exitNote">Back to the Ek Haven home screen. Your coins and progress stay saved on this device.</small>
        </div>
        <div class="set-right">
          <button class="acct-btn" id="setEmail" hidden><span class="ab-ic">✉</span><span>Email: sign in or register</span></button>
          <button class="acct-btn alt" id="setPass" hidden><span class="ab-ic">🔑</span><span>Change password</span></button>
          <button class="acct-btn out" id="setSignOut" hidden><span class="ab-ic">⎋</span><span>Sign out</span></button>
          <button class="acct-btn alt" id="setInstall" hidden><span class="ab-ic">📲</span><span>Install the app</span></button>
          <button class="acct-btn alt" id="setTips"><span class="ab-ic">🎓</span><span>Replay the tutorial</span></button>
          <p class="acct-off" id="installHint" hidden>To install on iPhone or iPad: tap Share, then "Add to Home Screen".</p>
        </div>
      </div>
      <div class="set-rule"></div>
      <div class="tg-grid">
        <div class="tg-box"><b>Sound</b><button class="tg" data-k="sound" role="switch"><span class="tg-txt">ON</span><i></i></button></div><div class="tg-box"><b>Smart Coach</b><button class="tg" data-k="coach" role="switch"><span class="tg-txt">ON</span><i></i></button></div><div class="tg-box"><b>Tips</b><button class="tg" data-k="tips" role="switch"><span class="tg-txt">ON</span><i></i></button></div><div class="tg-box"><b>Voice call</b><button class="tg" data-k="voice" role="switch"><span class="tg-txt">ON</span><i></i></button></div>
      </div>
      <p class="set-legal"><a href="/privacy" target="_blank" rel="noopener">Privacy</a> · <a href="mailto:support@sedigitaltransformation.com?subject=Ek%20Haven">Contact</a> · Ek Haven by SE Digital Transformation</p>
    </div>
  </div>
</div>
<div class="overlay" id="rulesOv" hidden>
  <div class="modal rules">
    <button class="x-close" data-close aria-label="Close">×</button>
    <h2>How to Play</h2>
    <h4>Goal</h4><p>Be the first to play every card in your hand. The winner scores the cards left in everyone else's hands.</p>
    <h4>On your turn</h4><ul><li>Play a card that matches the top card's <b>color</b>, <b>number</b> or <b>symbol</b>.</li><li>Wild cards can be played on anything, and you pick the next color.</li><li>Can't play? Draw a card. If it fits, you may play it.</li></ul>
    <h4>Action cards</h4><ul><li><b>Skip</b>: the next player misses a turn.</li><li><b>Reverse</b>: play changes direction.</li><li><b>Draw Two</b>: the next player draws 2 and misses a turn.</li><li><b>Wild Draw Four</b>: pick a color; the next player draws 4 and misses a turn.</li></ul>
    <h4>Call EK!</h4><p>When you play your second-to-last card, press the big <b>EK!</b> button (or say it out loud with Voice call). If someone catches you first, you draw 2.</p>
    <h4>Coins</h4><p>Bet coins when you start a game. The winner takes the pot: the bet times the number of players. Get more coins from the Mega Bonus wheel, the hourly free coins, daily gifts and level-ups.</p>
    <div class="modal-foot"><button class="pill green" data-close>Got it</button></div>
  </div>
</div>
<div class="overlay" id="authOv" hidden>
  <div class="modal pick auth">
    <button class="x-close" data-close aria-label="Close">×</button>
    <h2 id="authTitle">Sign in</h2>
    <div class="seg" id="authTabs"><button data-v="in" class="on">Sign in</button><button data-v="up">Register</button></div>
    <form id="authForm" autocomplete="on">
      <label class="lbl" for="auName" id="auNameL" hidden>Your name</label><input class="field" id="auName" maxlength="16" autocomplete="nickname" hidden>
      <label class="lbl" for="auEmail" id="auEmailL">Email</label><input class="field" id="auEmail" type="email" maxlength="200" autocomplete="email">
      <label class="lbl" for="auPass" id="auPassL">Password</label><input class="field" id="auPass" type="password" maxlength="200" autocomplete="current-password">
      <label class="lbl" for="auPass2" id="auPass2L" hidden>New password</label><input class="field" id="auPass2" type="password" maxlength="200" autocomplete="new-password" hidden>
      <p class="auth-msg" id="authMsg"></p>
      <button class="pill green" type="submit" id="authGo">Sign in</button>
    </form>
    <button class="linklike" id="authForgot">Forgot your password?</button>
    <p class="muted small" id="authNote">Your coins, level and stats are saved to your account so you can play on any device.</p>
    <p class="muted small auth-priv">Your email is only used for your account. <a href="/privacy" target="_blank" rel="noopener">Privacy</a></p>
  </div>
</div>
<div class="coin-fly" id="coinFly" aria-hidden="true"></div>
<div class="toast" id="shToast"></div>
`;
