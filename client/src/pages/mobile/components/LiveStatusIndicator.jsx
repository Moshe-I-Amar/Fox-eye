import React, { memo } from 'react';

/**
 * LiveStatusIndicator — memoized tri-state connection dot.
 *
 * Isolated from map layer to prevent map re-renders on status change.
 *
 * States:
 *   connected    → Green dot + pulse ring  + "LIVE"
 *   reconnecting → Amber dot + pulse ring  + "SYNC"
 *   disconnected → Red dot   + no ring     + "OFFLINE"
 *
 * @param {{ status: 'connected'|'reconnecting'|'disconnected', violations?: number }} props
 */
const STATUS_CONFIG = {
  connected:    { dot: 'bg-emerald-400', ring: 'bg-emerald-400/30', pulse: true,  label: 'LIVE',    text: 'text-emerald-400' },
  reconnecting: { dot: 'bg-amber-400',   ring: 'bg-amber-400/30',   pulse: true,  label: 'SYNC',    text: 'text-amber-400'   },
  disconnected: { dot: 'bg-red-500',     ring: '',                   pulse: false, label: 'OFFLINE', text: 'text-red-400'     },
};

const LiveStatusIndicator = memo(({ status = 'disconnected', violations = 0 }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;

  return (
    <div
      className="flex items-center gap-2"
      title={`Connection: ${status}${violations > 0 ? ` · ${violations} active violation${violations > 1 ? 's' : ''}` : ''}`}
      aria-label={`Status: ${cfg.label}${violations > 0 ? `, ${violations} violations` : ''}`}
    >
      {/* Dot with optional pulse ring */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {cfg.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.ring} opacity-75`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.dot}`} />
      </span>

      {/* Label (hidden on xs) */}
      <span className={`text-[9px] tracking-widest uppercase font-semibold hidden sm:inline ${cfg.text}`}>
        {cfg.label}
      </span>

      {/* Violation badge */}
      {violations > 0 && (
        <span
          aria-label={`${violations} active violation${violations > 1 ? 's' : ''}`}
          className="px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40
            text-[9px] text-red-400 font-bold tracking-wider leading-none"
        >
          {violations > 9 ? '9+' : violations}
        </span>
      )}
    </div>
  );
});

LiveStatusIndicator.displayName = 'LiveStatusIndicator';

export default LiveStatusIndicator;
