import React from 'react';
import TopNav from './components/TopNav';
import BottomReportingSheet from './components/BottomReportingSheet';

/**
 * MobileLayout — Phase 2 map-centric shell.
 *
 * Layer stack (bottom → top):
 *   z-0    Base map (`mapSlot`) — fills 100dvh via `absolute inset-0`
 *   z-[400] BottomReportingSheet — slides up from bottom; max 65vh
 *   z-[500] TopNav — glassmorphism header; always on top
 *
 * The map is always visible: the header floats above, the sheet never
 * covers more than 65vh, and when collapsed the sheet is only ~2.75rem tall.
 *
 * Props:
 *   mapSlot          {ReactNode}         — full-screen base map component
 *   user             {object|null}       — auth user (name → TopNav avatar initials)
 *   connectionStatus {string}            — 'connected' | 'reconnecting' | 'disconnected'
 *   gpsStatus        {string}            — 'locked' | 'searching' | 'unavailable'
 *   wakeLockStatus   {string}            — 'active' | 'released' | 'unsupported'
 *   violations       {number}            — active violation count (currently unused; kept for future use)
 *   userCoordinates  {[lng,lat]|null}    — own GPS position (forwarded to ReportingGrid)
 *   onQueueEvent     {fn}                — offline event queue enqueue
 *   queuedCount      {number}            — offline queue length
 *   feedSlot         {ReactNode}         — MobileEventFeed (rendered in Events tab of sheet)
 *   notificationSlot {ReactNode}         — NotificationPrompt banner (above grid in Report tab)
 *   onBack           {fn|undefined}      — renders ← in TopNav when provided
 */
const MobileLayout = ({
  mapSlot,
  user,
  connectionStatus  = 'disconnected',
  gpsStatus         = 'searching',
  wakeLockStatus    = 'unsupported',
  violations        = 0,
  userCoordinates,
  onQueueEvent,
  queuedCount       = 0,
  feedSlot,
  notificationSlot,
  onBack,
}) => (
  // Root: full-screen, overflow-hidden so the sheet translate never causes scroll
  <div className="relative bg-jet overflow-hidden" style={{ height: '100dvh' }}>

    {/* ── z-0: full-screen base map ──────────────────────────────────────── */}
    {mapSlot}

    {/* ── z-[500]: glassmorphism floating header ─────────────────────────── */}
    <TopNav
      connectionStatus={connectionStatus}
      gpsStatus={gpsStatus}
      wakeLockStatus={wakeLockStatus}
      user={user}
      onBack={onBack}
    />

    {/* ── z-[400]: draggable bottom reporting sheet ──────────────────────── */}
    <BottomReportingSheet
      userCoordinates={userCoordinates}
      onQueueEvent={onQueueEvent}
      queuedCount={queuedCount}
      feedSlot={feedSlot}
      notificationSlot={notificationSlot}
    />
  </div>
);

export default MobileLayout;
