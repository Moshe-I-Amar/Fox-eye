import React from 'react';
import { useNavigate } from 'react-router-dom';

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
  locked:    { icon: '◎', color: 'text-emerald-400', title: 'GPS locked' },
  searching: { icon: '◌', color: 'text-amber-400 animate-pulse', title: 'Searching GPS…' },
  unavailable: { icon: '⊗', color: 'text-red-400', title: 'GPS unavailable' }
};

/**
 * MobileLayout — full-screen shell for the field mobile UI.
 *
 * Props:
 *   activeTab        {string}   — 'panic' | 'map' | 'feed'
 *   onTabChange      {fn}       — (key: string) => void
 *   connectionStatus {string}   — 'connected' | 'reconnecting' | 'disconnected'
 *   gpsStatus        {string}   — 'locked' | 'searching' | 'unavailable'
 *   wakeLockStatus   {string}   — 'active' | 'released' | 'unsupported'
 *   onBack           {fn}       — optional; renders back arrow to /dashboard
 */
const MobileLayout = ({
  children,
  activeTab,
  onTabChange,
  connectionStatus = 'disconnected',
  gpsStatus = 'searching',
  wakeLockStatus = 'unsupported',
  onBack
}) => {
  const connStyle = CONNECTION_STYLES[connectionStatus] ?? CONNECTION_STYLES.disconnected;
  const gpsStyle  = GPS_STYLES[gpsStatus] ?? GPS_STYLES.searching;

  return (
    // 100dvh: accounts for mobile browser chrome hiding/showing (unlike h-screen / 100vh)
    <div
      className="flex flex-col bg-jet text-gold overflow-hidden"
      style={{ height: '100dvh' }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gold/20 shrink-0 bg-charcoal/80 backdrop-blur-sm">
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
          {/* Wake lock indicator — only shown when supported */}
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

          {/* GPS status */}
          <span
            title={gpsStyle.title}
            className={`text-sm leading-none ${gpsStyle.color}`}
            aria-label={gpsStyle.title}
          >
            {gpsStyle.icon}
          </span>

          {/* Connection status */}
          <div className="flex items-center gap-1.5" title={`Socket: ${connectionStatus}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connStyle.dot}`} />
            <span className="text-[9px] tracking-widest text-gold/40 uppercase hidden sm:inline">
              {connStyle.label}
            </span>
          </div>
        </div>
      </header>

      {/* ── Content area ────────────────────────────────────────────── */}
      {/* On md+ (tablet/desktop): show sidebar nav instead of bottom tabs */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar nav — only md and above */}
        <nav className="hidden md:flex flex-col w-20 border-r border-gold/20 bg-charcoal shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              aria-current={activeTab === tab.key ? 'page' : undefined}
              className={`flex flex-col items-center py-5 text-[10px] tracking-widest uppercase transition-colors
                ${activeTab === tab.key
                  ? 'text-gold border-r-2 border-gold bg-gold/5'
                  : 'text-gold/40 hover:text-gold/70'}`}
            >
              <span className="text-xl leading-none mb-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </div>

      {/* ── Bottom nav — mobile only ─────────────────────────────────── */}
      <nav
        className="flex md:hidden border-t border-gold/20 bg-charcoal shrink-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            aria-current={activeTab === tab.key ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center py-3 text-[10px] tracking-widest uppercase transition-colors
              ${activeTab === tab.key
                ? 'text-gold border-t-2 border-gold'
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
