import { useEffect, useRef, useState } from 'react';

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const voiceSupported = !!SR;

// Words speech engines commonly hear when someone shouts "UNO!"
const UNO_WORDS = /\b(uno|oono|ouno|you know|u no|juno|you no)\b/i;

/**
 * Listens continuously while `enabled` and calls `onUno` when the player says "UNO".
 * Chrome/Edge/Safari support this; Firefox does not (the button still works).
 */
export function useVoiceUno(enabled, onUno) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const cb = useRef(onUno);
  cb.current = onUno;

  useEffect(() => {
    if (!enabled || !SR) return undefined;
    let stopped = false;
    let last = 0;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onstart = () => { setListening(true); setError(null); };
    rec.onerror = (e) => { if (e.error === 'not-allowed') { setError('Microphone permission denied'); stopped = true; } };
    rec.onend = () => { setListening(false); if (!stopped) setTimeout(() => { try { rec.start(); } catch { /* already started */ } }, 300); };
    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const text = ev.results[i][0].transcript;
        if (UNO_WORDS.test(text) && Date.now() - last > 1500) { last = Date.now(); cb.current?.(); }
      }
    };
    try { rec.start(); } catch (e) { setError(String(e.message || e)); }
    return () => { stopped = true; try { rec.stop(); } catch { /* ignore */ } setListening(false); };
  }, [enabled]);

  return { listening, error, supported: voiceSupported };
}
