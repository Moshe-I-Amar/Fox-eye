import React, { memo } from 'react';
import LiveStatusIndicator from './LiveStatusIndicator';

// ── Fox Eye SVG logo ──────────────────────────────────────────────────────────
// Minimal golden fox head silhouette with two eye dots and ear tips.
const FoxEyeLogo = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Ear tips */}
    <path d="M7 10 L4 3 L11 8" fill="#C7A76C" />
    <path d="M25 10 L28 3 L21 8" fill="#C7A76C" />
    {/* Head */}
    <path
      d="M16 5 C9 5 5 10 5 16 C5 22 9 27 16 27 C23 27 27 22 27 16 C27 10 23 5 16 5Z"
      fill="#C7A76C"
    />
    {/* Eyes */}
    <ellipse cx="12" cy="15" rx="2.2" ry="2.5" fill="#0a0a0a" />
    <ellipse cx="20" cy="15" rx="2.2" ry="2.5" fill="#0a0a0a" />
    {/* Eye glint */}
    <circle cx="12.8" cy="14.2" r="0.7" fill="rgba(255,255,255,0.6)" />
    <circle cx="20.8" cy="14.2" r="0.7" fill="rgba(255,255,255,0.6)" />
    {/* Nose */}
    <ellipse cx="16" cy="21" rx="1.5" ry="1" fill="#0a0a0a" opacity="0.6" />
  </svg>
);

// ── GPS state icon config ─────────────────────────────────────────────────────
const GPS_STYLES = {
  locked:      { icon: '◎', className: 'text-emerald-400',              title: 'GPS locked'       },
  searching:   { icon: '◌', className: 'text-amber-400 animate-pulse',  title: 'Searching GPS…'   },
  unavailable: { icon: '⊗', className: 'text-red-400',                  title: 'GPS unavailable'  },
};

/**
 * TopNav — glassmorphism floating header for the mobile operational view.
 *
 * Isolated in its own memoized component so status updates never cause
 * the base map layer to re-render.
 *
 * Props:
 *   connectionStatus {string}       — 'connected' | 'reconnecting' | 'disconnected'
 *   gpsStatus        {string}       — 'locked' | 'searching' | 'unavailable'
 *   wakeLockStatus   {string}       — 'active' | 'released' | 'unsupported'
 *   violations       {number}       — active violation count (drives badge on LiveStatusIndicator)
 *   user             {object|null}  — auth user (name used for avatar initials)
 *   onBack           {fn|undefined} — if provided, renders a ← back arrow
 */
const TopNav = memo(({
  connectionStatus = 'disconnected',
  gpsStatus        = 'searching',
  wakeLockStatus   = 'unsupported',
  violations       = 0,
  user             = null,
  onBack,
}) => {
  const gpsStyle = GPS_STYLES[gpsStatus] ?? GPS_STYLES.searching;

  // Build up to 2 initials from user display name
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <header
      className="absolute top-0 inset-x-0 z-[500]
        flex items-center justify-between gap-3 px-4
        bg-jet/80 backdrop-blur-[10px]
        border-b border-gold/20 shadow-[0_2px_16px_rgba(0,0,0,0.5)]"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: '0.5rem',
      }}
    >
      {/* ── Left: back arrow + Fox Eye logo ──────────────────────────────── */}
      <div className="flex items-center gap-2 min-w-[2.5rem]">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to dashboard"
            className="text-gold/60 hover:text-gold transition-colors text-lg leading-none -ml-1 pr-1"
          >
            ←
          </button>
        )}
        <FoxEyeLogo />
        <span className="text-[10px] tracking-[0.18em] text-gold/70 uppercase font-bold select-none hidden xs:inline">
          Fox-Eye
        </span>
      </div>

      {/* ── Center: live status indicator ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center">
        <LiveStatusIndicator status={connectionStatus} violations={violations} />
      </div>

      {/* ── Right: GPS icon + wake lock dot + user avatar ────────────────── */}
      <div className="flex items-center gap-2.5 min-w-[2.5rem] justify-end">
        <span
          title={gpsStyle.title}
          aria-label={gpsStyle.title}
          className={`text-sm leading-none ${gpsStyle.className}`}
        >
          {gpsStyle.icon}
        </span>

        {wakeLockStatus !== 'unsupported' && (
          <span
            title={wakeLockStatus === 'active' ? 'Screen awake' : 'Screen lock inactive'}
            aria-label={wakeLockStatus === 'active' ? 'Screen awake' : 'Screen lock inactive'}
            className={`text-xs leading-none transition-colors ${
              wakeLockStatus === 'active' ? 'text-gold/50' : 'text-gold/20'
            }`}
          >
            {wakeLockStatus === 'active' ? '■' : '□'}
          </span>
        )}

        {/* User avatar — initials in a gold-gradient circle */}
        <div
          title={user?.name ?? 'Profile'}
          aria-label={`Logged in as ${user?.name ?? 'unknown'}`}
          className="w-7 h-7 rounded-full
            bg-gradient-to-br from-gold to-gold-light
            flex items-center justify-center
            text-jet text-[10px] font-bold
            border border-gold/40 select-none shrink-0
            shadow-gold-glow"
        >
          {initials}
        </div>
      </div>
    </header>
  );
});

TopNav.displayName = 'TopNav';

export default TopNav;
