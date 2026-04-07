import React, { memo, useState, useCallback } from 'react';

// ── Fox Eye SVG logo ──────────────────────────────────────────────────────────
const FoxEyeLogo = () => (
  <svg
    width="28"
    height="28"
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

// ── Status dot — green when connected, red otherwise ─────────────────────────
const STATUS_DOT = {
  connected:    { dot: 'bg-emerald-400', ring: 'bg-emerald-400/30', pulse: true,  label: 'Connected'    },
  reconnecting: { dot: 'bg-red-500',     ring: 'bg-red-500/30',     pulse: true,  label: 'Reconnecting' },
  disconnected: { dot: 'bg-red-500',     ring: '',                   pulse: false, label: 'Offline'      },
};

const NetworkDot = memo(({ status = 'disconnected' }) => {
  const cfg = STATUS_DOT[status] ?? STATUS_DOT.disconnected;
  return (
    <span className="relative flex h-3 w-3 shrink-0" aria-label={cfg.label} title={cfg.label}>
      {cfg.pulse && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.ring} opacity-75`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${cfg.dot}`} />
    </span>
  );
});
NetworkDot.displayName = 'NetworkDot';

// ── GPS status config ─────────────────────────────────────────────────────────
const GPS_LABELS = {
  locked:      { label: 'GPS locked',      color: 'text-emerald-400' },
  searching:   { label: 'Searching GPS…',  color: 'text-amber-400'   },
  unavailable: { label: 'GPS unavailable', color: 'text-red-400'     },
};

// ── Burger icon ───────────────────────────────────────────────────────────────
const BurgerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <rect x="2" y="5"  width="18" height="2" rx="1" fill="currentColor" />
    <rect x="2" y="10" width="18" height="2" rx="1" fill="currentColor" />
    <rect x="2" y="15" width="18" height="2" rx="1" fill="currentColor" />
  </svg>
);

// ── Close icon ────────────────────────────────────────────────────────────────
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4 4 L16 16 M16 4 L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ── Slide-in drawer menu ──────────────────────────────────────────────────────
const MenuDrawer = memo(({ open, onClose, user, gpsStatus, wakeLockStatus, onBack }) => {
  const gps = GPS_LABELS[gpsStatus] ?? GPS_LABELS.searching;
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[510] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className={`fixed top-0 right-0 z-[520] h-full w-72 max-w-[85vw]
          bg-charcoal border-l border-gold/20
          shadow-[−4px_0_32px_rgba(0,0,0,0.6)]
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-label="Navigation menu"
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-5 border-b border-gold/20"
          style={{
            paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
            paddingBottom: '0.75rem',
          }}
        >
          <span className="text-[11px] tracking-[0.2em] uppercase font-bold text-gold/70">
            Menu
          </span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="text-gold/50 hover:text-gold transition-colors p-1 -mr-1"
          >
            <CloseIcon />
          </button>
        </div>

        {/* User profile card */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gold/10">
          <div
            className="w-10 h-10 rounded-full shrink-0
              bg-gradient-to-br from-gold to-gold-light
              flex items-center justify-center
              text-jet text-sm font-bold
              border border-gold/40 shadow-gold-glow select-none"
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user?.name ?? '—'}</p>
            <p className="text-gray-400 text-[11px] truncate capitalize">{user?.operationalRole?.replace(/_/g, ' ') ?? user?.role ?? ''}</p>
          </div>
        </div>

        {/* Status rows */}
        <div className="flex flex-col gap-1 px-5 py-3 border-b border-gold/10">
          {/* GPS status */}
          <div className="flex items-center gap-3 py-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-gray-400">
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-gray-400 text-xs">GPS</span>
            <span className={`ml-auto text-xs font-medium ${gps.color}`}>{gps.label}</span>
          </div>

          {/* Wake lock (hidden if unsupported) */}
          {wakeLockStatus !== 'unsupported' && (
            <div className="flex items-center gap-3 py-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-gray-400">
                <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-gray-400 text-xs">Screen</span>
              <span className={`ml-auto text-xs font-medium ${wakeLockStatus === 'active' ? 'text-gold' : 'text-gray-500'}`}>
                {wakeLockStatus === 'active' ? 'Awake' : 'Default'}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 px-4 py-3 mt-auto">
          {onBack && (
            <button
              onClick={() => { onClose(); onBack(); }}
              className="flex items-center gap-3 px-3 py-3 rounded-lg
                text-gray-300 hover:text-white hover:bg-slate-dark
                transition-colors text-sm font-medium w-full text-left"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Dashboard
            </button>
          )}
        </div>
      </aside>
    </>
  );
});
MenuDrawer.displayName = 'MenuDrawer';

// ── TopNav — simplified 3-column header ──────────────────────────────────────
/**
 * TopNav — glassmorphism floating header for the mobile operational view.
 *
 * Three columns:
 *   Left   — Fox-Eye logo
 *   Center — Network status dot (green = connected, red = offline/reconnecting)
 *   Right  — Burger menu icon (opens slide-in drawer)
 *
 * Props:
 *   connectionStatus {string}       — 'connected' | 'reconnecting' | 'disconnected'
 *   gpsStatus        {string}       — 'locked' | 'searching' | 'unavailable'
 *   wakeLockStatus   {string}       — 'active' | 'released' | 'unsupported'
 *   user             {object|null}  — auth user (shown in drawer)
 *   onBack           {fn|undefined} — "Back to Dashboard" action exposed in drawer
 */
const TopNav = memo(({
  connectionStatus = 'disconnected',
  gpsStatus        = 'searching',
  wakeLockStatus   = 'unsupported',
  user             = null,
  onBack,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu  = useCallback(() => setMenuOpen(true),  []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      <header
        className="absolute top-0 inset-x-0 z-[500]
          grid grid-cols-3 items-center px-4
          bg-jet/80 backdrop-blur-[10px]
          border-b border-gold/20 shadow-[0_2px_16px_rgba(0,0,0,0.5)]"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingBottom: '0.5rem',
        }}
      >
        {/* ── Col 1 (left): Fox-Eye logo ──────────────────────────────────── */}
        <div className="flex items-center">
          <FoxEyeLogo />
        </div>

        {/* ── Col 2 (center): network status dot ──────────────────────────── */}
        <div className="flex items-center justify-center">
          <NetworkDot status={connectionStatus} />
        </div>

        {/* ── Col 3 (right): burger menu button ───────────────────────────── */}
        <div className="flex items-center justify-end">
          <button
            onClick={openMenu}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            className="text-gold/70 hover:text-gold transition-colors p-1 -mr-1"
          >
            <BurgerIcon />
          </button>
        </div>
      </header>

      {/* Slide-in drawer (portaled above everything) */}
      <MenuDrawer
        open={menuOpen}
        onClose={closeMenu}
        user={user}
        gpsStatus={gpsStatus}
        wakeLockStatus={wakeLockStatus}
        onBack={onBack}
      />
    </>
  );
});

TopNav.displayName = 'TopNav';

export default TopNav;
