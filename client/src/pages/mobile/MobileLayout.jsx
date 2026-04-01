import React from 'react';

const TABS = [
  { key: 'panic', label: 'PANIC',  icon: '⚠' },
  { key: 'map',   label: 'MAP',    icon: '⊙' },
  { key: 'feed',  label: 'EVENTS', icon: '≡' }
];

const CONNECTION_STYLES = {
  connected:    { dot: 'bg-emerald-400', label: 'LIVE' },
  reconnecting: { dot: 'bg-amber-400 animate-pulse', label: 'RECONNECTING' },
  disconnected: { dot: 'bg-red-500', label: 'OFFLINE' }
};

const GPS_STYLES = {
  locked:      { icon: '◎', color: 'text-emerald-400', title: 'GPS locked' },
  searching:   { icon: '◌', color: 'text-amber-400 animate-pulse', title: 'Searching GPS…' },
  unavailable: { icon: '⊗', color: 'text-red-400', title: 'GPS unavailable' }
};

/**
 * MobileLayout — full-screen shell. The map fills the entire viewport; header
 * and bottom nav float as translucent overlays. Panel content (panic / feed)
 * slides up as a bottom sheet, keeping the map always visible above it —
 * the same pattern as Google Maps mobile.
 *
 * Props:
 *   mapSlot          {ReactNode} — always-visible full-screen base map
 *   activeTab        {string}    — 'panic' | 'map' | 'feed'
 *   onTabChange      {fn}        — (key: string) => void
 *   connectionStatus {string}    — 'connected' | 'reconnecting' | 'disconnected'
 *   gpsStatus        {string}    — 'locked' | 'searching' | 'unavailable'
 *   wakeLockStatus   {string}    — 'active' | 'released' | 'unsupported'
 *   onBack           {fn}        — optional; renders back arrow
 *   children         {ReactNode} — overlay panel content (null/empty on map tab)
 */
const MobileLayout = ({
  children,
  mapSlot,
  activeTab,
  onTabChange,
  connectionStatus = 'disconnected',
  gpsStatus = 'searching',
  wakeLockStatus = 'unsupported',
  onBack
}) => {
  const connStyle = CONNECTION_STYLES[connectionStatus] ?? CONNECTION_STYLES.disconnected;
  const gpsStyle  = GPS_STYLES[gpsStatus] ?? GPS_STYLES.searching;

  // Sheet is visible for every tab except the pure map view.
  const showPanel = activeTab !== 'map';

  return (
    // Root: full-screen container. The map lives at z-0 here; all chrome floats above.
    <div className="relative bg-jet overflow-hidden" style={{ height: '100dvh' }}>

      {/* ── Base layer: map fills the entire viewport ─────────────────────── */}
      {mapSlot}

      {/* ── Floating header — always on top ───────────────────────────────── */}
      <header
        className="absolute top-0 inset-x-0 z-[500] flex items-center justify-between
          px-4 py-2 bg-jet/75 backdrop-blur-md border-b border-gold/20"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back to dashboard"
              className="text-gold/60 hover:text-gold transition-colors mr-1 text-lg leading-none"
            >
              ←
            </button>
          )}
          <span className="text-xs tracking-widest text-gold/70 uppercase font-semibold">
            Fox-Eye Field
          </span>
        </div>

        <div className="flex items-center gap-3">
          {wakeLockStatus !== 'unsupported' && (
            <span
              title={wakeLockStatus === 'active' ? 'Screen awake' : 'Screen lock inactive'}
              aria-label={wakeLockStatus === 'active' ? 'Screen awake' : 'Screen lock inactive'}
              className={`text-xs leading-none transition-colors ${
                wakeLockStatus === 'active' ? 'text-gold/60' : 'text-gold/20'
              }`}
            >
              {wakeLockStatus === 'active' ? '■' : '□'}
            </span>
          )}

          <span
            title={gpsStyle.title}
            aria-label={gpsStyle.title}
            className={`text-sm leading-none ${gpsStyle.color}`}
          >
            {gpsStyle.icon}
          </span>

          <div className="flex items-center gap-1.5" title={`Socket: ${connectionStatus}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connStyle.dot}`} />
            <span className="text-[9px] tracking-widest text-gold/40 uppercase hidden sm:inline">
              {connStyle.label}
            </span>
          </div>
        </div>
      </header>

      {/* ── Bottom sheet panel (panic / feed) ─────────────────────────────── */}
      {/*
        Sits above the map (z-[400]) but below the nav (z-[500]).
        `translate-y-full` pushes the sheet off screen when on map tab;
        `translate-y-0` slides it up for panic / feed.
        max-h keeps the map always visible above the sheet — Google Maps style.
      */}
      <div
        className={`absolute inset-x-0 z-[400]
          bg-jet/92 backdrop-blur-md border-t border-gold/20
          transition-transform duration-300 ease-out
          ${showPanel ? 'translate-y-0' : 'translate-y-full'}`}
        style={{
          bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
          maxHeight: '62vh'
        }}
      >
        {/* Drag-handle visual cue (matches iOS / Google Maps aesthetic) */}
        <div className="flex justify-center pt-2 pb-0.5 shrink-0">
          <div className="w-9 h-1 rounded-full bg-gold/25" />
        </div>

        {/* Scrollable panel body */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(62vh - 1.25rem)' }}>
          {children}
        </div>
      </div>

      {/* ── Floating bottom nav — always on top ───────────────────────────── */}
      <nav
        className="absolute bottom-0 inset-x-0 z-[500] flex
          bg-jet/85 backdrop-blur-md border-t border-gold/20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            aria-current={activeTab === tab.key ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center py-3 text-[10px] tracking-widest uppercase transition-colors
              ${activeTab === tab.key
                ? 'text-gold border-t-2 border-gold -mt-px'
                : 'text-gold/40 hover:text-gold/70'}`}
          >
            <span className="text-lg leading-none mb-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default MobileLayout;
