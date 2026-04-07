import React, { useState, useCallback } from 'react';
import Button from '../../components/ui/Button';
import { eventApi } from '../../services/eventApi';
import EventCard from './EventCard';

const MobileEventFeed = ({
  events = [],
  loading = false,
  error = '',
  refetch,
  onShowOnMap,
  onEventUpdate,
}) => {
  const [respondingIds, setRespondingIds] = useState(new Set());

  const respond = useCallback(async (id, action) => {
    setRespondingIds((prev) => new Set([...prev, id]));
    const optimisticStatus = action === 'acknowledge' ? 'ACKNOWLEDGED' : 'RESOLVED';
    onEventUpdate?.(id, { status: optimisticStatus });
    try {
      await (action === 'acknowledge' ? eventApi.acknowledgeEvent(id) : eventApi.resolveEvent(id));
    } catch {
      refetch?.();
    } finally {
      setRespondingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }, [onEventUpdate, refetch]);

  const activeCount = events.filter((e) => e.status === 'ACTIVE').length;

  return (
    <div className="flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gold/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gold/60 uppercase tracking-widest">Field Events</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] text-red-300 font-semibold tracking-wider">
              {activeCount} ACTIVE
            </span>
          )}
        </div>
        <button onClick={refetch} disabled={loading} aria-label="Refresh events" title="Refresh"
          className="text-gold/40 hover:text-gold disabled:opacity-30 transition-colors text-sm px-2 py-1">
          {loading ? '↻' : '↺'}
        </button>
      </div>

      <div>
        {loading && events.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gold/40 text-sm">Loading…</div>
        )}
        {error && (
          <div className="flex flex-col items-center gap-3 p-6">
            <p className="text-red-300 text-sm text-center">{error}</p>
            <Button variant="outline" onClick={refetch}>Retry</Button>
          </div>
        )}
        {!loading && !error && events.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gold/30 text-sm">No field events</div>
        )}
        {events.map((event) => (
          <EventCard
            key={event._id}
            event={event}
            isPending={respondingIds.has(event._id)}
            onShowOnMap={onShowOnMap}
            onRespond={respond}
          />
        ))}
      </div>
    </div>
  );
};

export default MobileEventFeed;
