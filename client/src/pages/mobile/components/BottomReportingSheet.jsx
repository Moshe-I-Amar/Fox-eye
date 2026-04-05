import React, { useState, useRef, useCallback } from 'react';
import ReportingGrid from './ReportingGrid';

// Swipe threshold in px to trigger expand / collapse
const SWIPE_THRESHOLD = 30;

/**
 * BottomReportingSheet — draggable action sheet that slides up from the bottom.
 *
 * z-[400]: sits above the map (z-0) but below the TopNav (z-[500]).
 *
 * ─ Collapsed ────────────────────────────────────────────────────────────────
 *   Shows only a drag handle + "⌃ REPORT" hint (≈ 2.75rem tall).
 *   Designed for thumb reach: the entire handle strip is a tap target.
 *
 * ─ Expanded ─────────────────────────────────────────────────────────────────
 *   Two-tab panel: "Report" (2×2 ReportingGrid) and "Events" (feedSlot).
 *   Max-height 65vh keeps the top map always partially visible.
 *
 * Interaction:
 *   • Tap handle → toggle
 *   • Swipe up (>30px) → expand
 *   • Swipe down (>30px) → collapse
 *
 * Props:
 *   userCoordinates  {[lng, lat] | null}  — GPS coords passed to ReportingGrid
 *   onQueueEvent     {fn}                 — offline queue enqueue
 *   queuedCount      {number}             — offline queue size
 *   feedSlot         {ReactNode}          — MobileEventFeed (rendered in Events tab)
 *   notificationSlot {ReactNode}          — NotificationPrompt banner (above grid)
 */
const BottomReportingSheet = ({
  userCoordinates,
  onQueueEvent,
  queuedCount = 0,
  feedSlot,
  notificationSlot,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeView, setActiveView] = useState('grid'); // 'grid' | 'feed'

  const touchStartY = useRef(null);

  const toggle = useCallback(() => setIsExpanded((v) => !v), []);

  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartY.current === null) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > SWIPE_THRESHOLD)  setIsExpanded(true);
    if (delta < -SWIPE_THRESHOLD) setIsExpanded(false);
    touchStartY.current = null;
  }, []);

  // Called by the EVENTS shortcut button inside ReportingGrid
  const handleViewEvents = useCallback(() => {
    setActiveView('feed');
    setIsExpanded(true);
  }, []);

  return (
    <div
      role="region"
      aria-label="Reporting panel"
      className={`absolute inset-x-0 bottom-0 z-[400]
        bg-jet/92 backdrop-blur-[10px]
        border-t border-gold/20
        shadow-[0_-4px_24px_rgba(0,0,0,0.45)]
        transition-transform duration-300 ease-out
        ${isExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-2.75rem)]'}`}
      style={{
        maxHeight: '65vh',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* ── Drag handle / tap-to-toggle strip ─────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse reporting panel' : 'Expand reporting panel'}
        onClick={toggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex flex-col items-center pt-2 pb-1.5 cursor-pointer group select-none touch-none"
      >
        {/* Visual drag bar */}
        <div className="w-9 h-1 rounded-full bg-gold/25 group-hover:bg-gold/50 transition-colors mb-2" />

        {/* Chevron + label */}
        <div className="flex items-center gap-1.5 text-[9px] text-gold/45 tracking-widest uppercase">
          <span
            className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
            aria-hidden="true"
          >
            ⌃
          </span>
          <span>{isExpanded ? 'CLOSE' : 'REPORT'}</span>
        </div>
      </div>

      {/* ── Expanded panel body ───────────────────────────────────────────── */}
      {isExpanded && (
        <div className="flex flex-col" style={{ maxHeight: 'calc(65vh - 3rem)' }}>

          {/* Tab switcher */}
          <div className="flex border-b border-gold/10 shrink-0">
            <button
              onClick={() => setActiveView('grid')}
              aria-current={activeView === 'grid' ? 'true' : undefined}
              className={`flex-1 py-2.5 text-[10px] tracking-widest uppercase font-semibold
                transition-colors focus:outline-none
                ${activeView === 'grid'
                  ? 'text-gold border-b-2 border-gold -mb-px'
                  : 'text-gold/40 hover:text-gold/60'}`}
            >
              ⚡ Report
            </button>
            <button
              onClick={() => setActiveView('feed')}
              aria-current={activeView === 'feed' ? 'true' : undefined}
              className={`flex-1 py-2.5 text-[10px] tracking-widest uppercase font-semibold
                transition-colors focus:outline-none
                ${activeView === 'feed'
                  ? 'text-gold border-b-2 border-gold -mb-px'
                  : 'text-gold/40 hover:text-gold/60'}`}
            >
              ≡ Events
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 pt-2">
            {activeView === 'grid' && (
              <>
                {notificationSlot && (
                  <div className="px-3 pb-1">{notificationSlot}</div>
                )}
                <ReportingGrid
                  userCoordinates={userCoordinates}
                  onQueueEvent={onQueueEvent}
                  queuedCount={queuedCount}
                  onViewEvents={handleViewEvents}
                  disabled={false}
                />
              </>
            )}

            {activeView === 'feed' && feedSlot}
          </div>
        </div>
      )}
    </div>
  );
};

export default BottomReportingSheet;
