import React from 'react';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import useFieldEvents from '../../hooks/useFieldEvents';

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

/**
 * MobileEventFeed — live field events list.
 *
 * Props:
 *   limit  {number}  — max events to show (default: 20)
 */
const MobileEventFeed = ({ limit = 20 }) => {
  const { events, loading, error, refetch } = useFieldEvents(limit);

  const activeCount = events.filter((e) => e.status === 'ACTIVE').length;

  return (
    <div className="flex flex-col h-full animate-fade-in">

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
      <div className="flex-1 overflow-y-auto">
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

          return (
            <div
              key={event._id}
              className={`px-4 py-3 flex items-start gap-3 border-b border-gold/10
                ${isActive ? 'bg-red-500/5' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant={typeCfg.variant} size="sm">{typeCfg.label}</Badge>
                  <Badge variant={statusCfg.variant} size="sm">{statusCfg.label}</Badge>
                </div>
                <div className="text-xs text-gold/70 truncate">
                  {event.senderId?.name || 'Unknown'} · {typeCfg.sublabel}
                </div>
                {event.acknowledgedBy && (
                  <div className="text-[10px] text-gold/40 mt-0.5">
                    Ack: {event.acknowledgedBy?.name || '—'}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-gold/40 whitespace-nowrap pt-0.5 shrink-0">
                {formatTime(event.createdAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MobileEventFeed;
