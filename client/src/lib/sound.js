// Zero-asset sound engine: every effect is synthesised with the Web Audio API,
// so there are no files to load and latency is a few milliseconds.
import { prefs } from './socket.js';

let ctx = null;
let master = null;
let muted = prefs.get('muted', false);
const listeners = new Set();

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Browsers require a user gesture before audio can start
if (typeof window !== 'undefined') {
  const unlock = () => { ac(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function noise(dur, { freq = 2000, q = 1, gain = 0.5, type = 'bandpass', at = 0 } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

function tone(freq, dur, { type = 'sine', gain = 0.3, at = 0, slide = null } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

const SOUNDS = {
  snap: () => { noise(0.07, { freq: 3200, q: 0.8, gain: 0.9 }); tone(180, 0.06, { type: 'triangle', gain: 0.25 }); },
  draw: () => noise(0.16, { freq: 1400, q: 0.6, gain: 0.35, type: 'highpass' }),
  shuffle: () => { for (let i = 0; i < 9; i++) noise(0.05, { freq: 2500 + i * 120, gain: 0.35, at: i * 0.045 }); },
  deal: () => { for (let i = 0; i < 7; i++) noise(0.05, { freq: 3000, gain: 0.4, at: i * 0.08 }); },
  plus2: () => { tone(330, 0.12, { type: 'square', gain: 0.12 }); tone(247, 0.2, { type: 'square', gain: 0.12, at: 0.1 }); },
  plus4: () => {
    tone(140, 0.7, { type: 'sawtooth', gain: 0.25, slide: 40 });
    noise(0.5, { freq: 200, q: 0.5, gain: 0.8, type: 'lowpass' });
    tone(70, 0.9, { type: 'sine', gain: 0.5, at: 0.05, slide: 35 });
  },
  turn: () => { tone(880, 0.18, { gain: 0.18 }); tone(1320, 0.3, { gain: 0.14, at: 0.09 }); },
  uno: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.22, at: i * 0.07 })); },
  caught: () => { tone(400, 0.35, { type: 'square', gain: 0.15, slide: 120 }); },
  skip: () => { tone(600, 0.1, { type: 'triangle', gain: 0.2 }); tone(400, 0.14, { type: 'triangle', gain: 0.2, at: 0.08 }); },
  reverse: () => { tone(300, 0.25, { type: 'triangle', gain: 0.18, slide: 700 }); },
  swap: () => { tone(500, 0.3, { type: 'sine', gain: 0.2, slide: 250 }); tone(250, 0.3, { type: 'sine', gain: 0.2, at: 0.1, slide: 500 }); },
  win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, { type: 'triangle', gain: 0.2, at: i * 0.12 })); },
  pop: () => tone(1200, 0.07, { gain: 0.12, slide: 1800 }),
  tick: () => tone(1500, 0.03, { type: 'square', gain: 0.05 }),
  error: () => tone(160, 0.18, { type: 'square', gain: 0.1 }),
};

export function play(name) {
  if (muted) return;
  try { SOUNDS[name]?.(); } catch { /* audio unavailable */ }
}

/** Spoken callout using speech synthesis (optional flourish). */
export function say(text) {
  if (muted || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.15; u.pitch = 1.25; u.volume = 0.9;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

export const sound = {
  isMuted: () => muted,
  setMuted(v) { muted = v; prefs.set('muted', v); listeners.forEach((l) => l(v)); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
