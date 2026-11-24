// Randomness helpers built on Web Crypto, which exists in both Node (18+) and browsers.
// This lets the exact same game/room code run on the server AND offline in the browser.

const cryptoApi = globalThis.crypto;

/** Uniform random integer in [0, max). Rejection sampling avoids modulo bias. */
export function randomInt(max) {
  if (max <= 1) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do { cryptoApi.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % max;
}

export function randomHex(bytes = 6) {
  const b = new Uint8Array(bytes);
  cryptoApi.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** URL-safe secret token (used for seat reclaim). */
export function randomToken(bytes = 18) {
  const b = new Uint8Array(bytes);
  cryptoApi.getRandomValues(b);
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return [...b].map((x) => A[x & 63]).join('');
}
