import React, { useState, useCallback } from 'react';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { eventApi } from '../../services/eventApi';

const TYPE_CONFIG = {
  INJURED: { label: 'INJURED', variant: 'red',   sublabel: 'Patzua' },
  AMBUSH:  { label: 'AMBUSH',  variant: 'gold',  sublabel: "Ma'arav" },
  LINK_UP: { label: 'LINK-UP', variant: 'green', sublabel: 'Havirat Koach' }
};

const STATUS_CONFIG = {
  ACTIVE:       { label: 'ACTIVE',       variant: 'red'   },
  ACKNOWLEDGED: { label: 'ACKNOWLEDGED', variant: 'gold'  },
  RESOLVED:     { label: 'RESOLVED',     variant: 'green' }
};

const formatTime = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate()     === today.getDate() &&
    d.getMonth()    === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  return isToday
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const hasValidCoords = (ev) => {
  const c = ev.coordinates?.coordinates;
  return Array.isArray(c) && c.length === 2 &&
    Number.isFinite(c[0]) && Number.isFinite(c[1]);
};

/**
 * MobileEventFeed — live field events list.
 *
 * Events are provided by the parent (MobileFieldView) via useFieldEvents so
 * the map and feed share one data source without double-fetching.
 *
 * Props:
 *   events        {FieldEvent[]}  — pre-fetched list (from parent)
 *   loading       {boolean}
 *   error         {string}
 *   refetch       {fn}
 *   onShowOnMap   {fn(coords: [lng, lat])}  — switch to map tab and fly to coords
 *   onEventUpdate {fn(id, patch)}           — optimistic local state update
 */
const MobileEventFeed = ({
  events = [],
  loading = false,
  error = '',
  refetch,
  onShowOnMap,
  onEventUpdate
}) => {
  const [respondingIds, setRespondingIds] = useState(new Set());

  const respond = useCallback(async (id, action) => {
    setRespondingIds((prev) => new Set([...prev, id]));
    // Optimistic: update status immediately so the button/badge reflects the
    // new state without waiting for the socket round-trip.
    const optimisticStatus = action === 'acknowledge' ? 'ACKNOWLEDGED' : 'RESOLVED';
    onEventUpdate?.(id, { status: optimisticStatus });
    try {
      await (action === 'acknowledge'
        ? eventApi.acknowledgeEvent(id)
        : eventApi.resolveEvent(id));
      // Socket will broadcast the confirmed update; useFieldEvents merges it.
    } catch {
      // Revert optimistic update on failure — socket won't fire, so re-fetch
      refetch?.();
    } finally {
      setRespondingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [onEventUpdate, refetch]);

  const activeCount = events.filter((e) => e.status === 'ACTIVE').length;

  return (
    <div className="flex flex-col animate-fade-in">

      {/* Summary header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gold/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gold/60 uppercase tracking-widest">Field Events</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40
              text-[10px] text-red-300 font-semibold tracking-wider">
              {activeCount} ACTIVE
            </span>
          )}
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          aria-label="Refresh events"
          title="Refresh"
          className="text-gold/40 hover:text-gold disabled:opacity-30 transition-colors text-sm px-2 py-1"
        >
          {loading ? '↻' : '↺'}
        </button>
      </div>

      {/* Content */}
      <div>
        {loading && events.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gold/40 text-sm">
            Loading…
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 p-6">
            <p className="text-red-300 text-sm text-center">{error}</p>
            <Button variant="outline" onClick={refetch}>Retry</Button>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gold/30 text-sm">
            No field events
          </div>
        )}

        {events.map((event) => {
          const typeCfg   = TYPE_CONFIG[event.eventType]   || { label: event.eventType, variant: 'gray', sublabel: '' };
          const statusCfg = STATUS_CONFIG[event.status]    || { label: event.status,    variant: 'gray' };
          const isActive  = event.status === 'ACTIVE';
          const isPending = respondingIds.has(event._id);
          const canAck    = event.status === 'ACTIVE';
          const canResolve = event.status === 'ACTIVE' || event.status === 'ACKNOWLEDGED';
          const showMapBtn = !!onShowOnMap && hasValidCoords(event);

          const senderName = event.senderId?.name || 'Unknown';
          const senderRole = event.senderId?.operationalRole
            ? event.senderId.operationalRole.replace(/_/g, ' ')
            : null;

          return (
            <div
              key={event._id}
              className={`px-4 py-3 border-b border-gold/10 ${isActive ? 'bg-red-500/5' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant={typeCfg.variant} size="sm">{typeCfg.label}</Badge>
                    <Badge variant={statusCfg.variant} size="sm">{statusCfg.label}</Badge>
                  </div>
                  <div className="text-xs text-gold/70 truncate">
                    {senderName}
                    {senderRole && (
                      <span className="text-gold/40"> · {senderRole}</span>
                    )}
                  </div>
                  {event.acknowledgedBy && (
                    <div className="text-[10px] text-gold/40 mt-0.5">
                      Ack: {event.acknowledgedBy?.name || '—'}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  {/* Show on map — flies to the event location */}
                  {showMapBtn && (
                    <button
                      type="button"
                      onClick={() => onShowOnMap(event.coordinates.coordinates)}
                      aria-label="Show on map"
                      title="Show on map"
                      className="text-gold/40 hover:text-gold transition-colors text-base leading-none"
                    >
                      ◎
                    </button>
                  )}
                  <div className="text-[10px] text-gold/40 whitespace-nowrap">
                    {formatTime(event.createdAt)}
                  </div>
                </div>
              </div>

              {(canAck || canResolve) && (
                <div className="flex gap-2 mt-2.5">
                  {canAck && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => respond(event._id, 'acknowledge')}
                      className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 active:bg-amber-500/20 disabled:opacity-40 transition-colors min-h-[36px]"
                    >
                      {isPending ? '…' : 'ACK'}
                    </button>
                  )}
                  {canResolve && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => respond(event._id, 'resolve')}
                      className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 active:bg-emerald-500/20 disabled:opacity-40 transition-colors min-h-[36px]"
                    >
                      {isPending ? '…' : 'RESOLVE'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MobileEventFeed;
