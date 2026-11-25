import { emblem } from '../shell/markup.js';

const EMBLEM = emblem('lg');

/** Ek Haven wordmark: the gold emblem + "EK HAVEN" in gold, like Spade Haven's. `size` = emblem height in px. */
export function Logo({ size = 40, className = '' }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} aria-label="Ek Haven" role="img">
      <span className="shrink-0 drop-shadow-[0_3px_5px_rgba(0,0,0,.5)] [&>svg]:w-full [&>svg]:h-full" style={{ width: size * 1.25, height: size * 1.25 }}
        dangerouslySetInnerHTML={{ __html: EMBLEM }} />
      <span className="font-bebas leading-none tracking-[2px] text-[#ffc83d]"
        style={{ fontSize: size * 0.95, textShadow: '0 1px 0 #c08510, 0 2px 0 #7d5006, 0 3px 0 #5a3a05, 0 6px 10px rgba(0,0,0,.5)' }}>
        EK HAVEN
      </span>
    </div>
  );
}
