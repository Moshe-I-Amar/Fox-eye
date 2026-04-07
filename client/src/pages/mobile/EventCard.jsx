import React from 'react';
import Badge from '../../components/ui/Badge';

const TYPE_CONFIG = {
  INJURED: { label: 'INJURED', variant: 'red',   sublabel: 'Patzua' },
  AMBUSH:  { label: 'AMBUSH',  variant: 'gold',  sublabel: "Ma'arav" },
  LINK_UP: { label: 'LINK-UP', variant: 'green', sublabel: 'Havirat Koach' },
};

const STATUS_CONFIG = {
  ACTIVE:       { label: 'ACTIVE',       variant: 'red'   },
  ACKNOWLEDGED: { label: 'ACKNOWLEDGED', variant: 'gold'  },
  RESOLVED:     { label: 'RESOLVED',     variant: 'green' },
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

export const hasValidCoords = (ev) => {
  const c = ev.coordinates?.coordinates;
  return Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
};

const EventCard = ({ event, isPending, onShowOnMap, onRespond }) => {
  const typeCfg   = TYPE_CONFIG[event.eventType]   || { label: event.eventType, variant: 'gray' };
  const statusCfg = STATUS_CONFIG[event.status]    || { label: event.status,    variant: 'gray' };
  const isActive  = event.status === 'ACTIVE';
  const canAck    = event.status === 'ACTIVE';
  const canResolve = event.status === 'ACTIVE' || event.status === 'ACKNOWLEDGED';
  const showMapBtn = !!onShowOnMap && hasValidCoords(event);
  const senderName = event.senderId?.name || 'Unknown';
  const senderRole = event.senderId?.operationalRole?.replace(/_/g, ' ') || null;

  return (
    <div className={`px-4 py-3 border-b border-gold/10 ${isActive ? 'bg-red-500/5' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant={typeCfg.variant} size="sm">{typeCfg.label}</Badge>
            <Badge variant={statusCfg.variant} size="sm">{statusCfg.label}</Badge>
          </div>
          <div className="text-xs text-gold/70 truncate">
            {senderName}
            {senderRole && <span className="text-gold/40"> · {senderRole}</span>}
          </div>
          {event.acknowledgedBy && (
            <div className="text-[10px] text-gold/40 mt-0.5">Ack: {event.acknowledgedBy?.name || '—'}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {showMapBtn && (
            <button type="button" onClick={() => onShowOnMap(event.coordinates.coordinates)}
              aria-label="Show on map" title="Show on map"
              className="text-gold/40 hover:text-gold transition-colors text-base leading-none">◎</button>
          )}
          <div className="text-[10px] text-gold/40 whitespace-nowrap">{formatTime(event.createdAt)}</div>
        </div>
      </div>
      {(canAck || canResolve) && (
        <div className="flex gap-2 mt-2.5">
          {canAck && (
            <button type="button" disabled={isPending} onClick={() => onRespond(event._id, 'acknowledge')}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 active:bg-amber-500/20 disabled:opacity-40 transition-colors min-h-[36px]">
              {isPending ? '…' : 'ACK'}
            </button>
          )}
          {canResolve && (
            <button type="button" disabled={isPending} onClick={() => onRespond(event._id, 'resolve')}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 active:bg-emerald-500/20 disabled:opacity-40 transition-colors min-h-[36px]">
              {isPending ? '…' : 'RESOLVE'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EventCard;
