import React, { useState, useRef, useCallback } from 'react';
import ReportingGrid from './ReportingGrid';

const SWIPE_THRESHOLD = 30;

const SheetTabBar = ({ activeView, onSelect }) => {
  const tab = (id, icon, label) => (
    <button onClick={() => onSelect(id)} aria-current={activeView === id ? 'true' : undefined}
      className={`flex-1 py-2.5 text-[10px] tracking-widest uppercase font-semibold transition-colors focus:outline-none ${activeView === id ? 'text-gold border-b-2 border-gold -mb-px' : 'text-gold/40 hover:text-gold/60'}`}>
      {icon} {label}
    </button>
  );
  return (
    <div className="flex border-b border-gold/10 shrink-0">
      {tab('grid', '⚡', 'Report')}
      {tab('feed', '≡', 'Events')}
    </div>
  );
};

const BottomReportingSheet = ({ userCoordinates, onQueueEvent, queuedCount = 0, feedSlot, notificationSlot }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeView, setActiveView] = useState('grid');
  const touchStartY = useRef(null);

  const toggle = useCallback(() => setIsExpanded((v) => !v), []);

  const handleTouchStart = useCallback((e) => { touchStartY.current = e.touches[0].clientY; }, []);
  const handleTouchEnd = useCallback((e) => {
    if (touchStartY.current === null) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > SWIPE_THRESHOLD)  setIsExpanded(true);
    if (delta < -SWIPE_THRESHOLD) setIsExpanded(false);
    touchStartY.current = null;
  }, []);

  const handleViewEvents = useCallback(() => { setActiveView('feed'); setIsExpanded(true); }, []);

  return (
    <div role="region" aria-label="Reporting panel"
      className={`absolute inset-x-0 bottom-0 z-[400] bg-jet/92 backdrop-blur-[10px] border-t border-gold/20 shadow-[0_-4px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out ${isExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-2.75rem)]'}`}
      style={{ maxHeight: '65vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>

      <div role="button" tabIndex={0} aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse reporting panel' : 'Expand reporting panel'}
        onClick={toggle} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle()}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
        className="flex flex-col items-center pt-2 pb-1.5 cursor-pointer group select-none touch-none">
        <div className="w-9 h-1 rounded-full bg-gold/25 group-hover:bg-gold/50 transition-colors mb-2" />
        <div className="flex items-center gap-1.5 text-[9px] text-gold/45 tracking-widest uppercase">
          <span className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} aria-hidden="true">⌃</span>
          <span>{isExpanded ? 'CLOSE' : 'REPORT'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="flex flex-col" style={{ maxHeight: 'calc(65vh - 3rem)' }}>
          <SheetTabBar activeView={activeView} onSelect={setActiveView} />
          <div className="overflow-y-auto flex-1 pt-2">
            {activeView === 'grid' && (
              <>
                {notificationSlot && <div className="px-3 pb-1">{notificationSlot}</div>}
                <ReportingGrid userCoordinates={userCoordinates} onQueueEvent={onQueueEvent}
                  queuedCount={queuedCount} onViewEvents={handleViewEvents} disabled={false} />
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
