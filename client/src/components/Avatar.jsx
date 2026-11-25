import { isPic, avatarUrl } from '../shell/avatars.js';

/** A player's Spade Haven picture (or an emoji from older saves), as a round badge. */
export function Avatar({ k, size = 40, className = '' }) {
  if (isPic(k)) {
    return <img src={avatarUrl(k)} alt="" draggable={false} width={size} height={size}
      className={`rounded-full object-cover shrink-0 ${className}`} style={{ width: size, height: size }} />;
  }
  return <span className={`inline-grid place-items-center shrink-0 ${className}`} style={{ width: size, height: size, fontSize: size * 0.6 }}>{k}</span>;
}
