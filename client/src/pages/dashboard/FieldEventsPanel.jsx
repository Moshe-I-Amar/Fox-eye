import React from 'react';
import Card from '../../components/ui/Card';
import { EVENT_TYPE_CONFIG, STATUS_BADGE_CLASS } from '../../utils/markerUtils';

const FieldEventsPanel = ({ visibleEvents, activeEventCount, fieldEventsLoading, showResolvedEvents, onToggleResolved, respondingIds, onRespond, onFocusEvent }) => (
  <Card className="mb-6" padding="small">
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gold">Field Events</h3>
        <div className="flex items-center gap-2">
          {activeEventCount > 0 && (
            <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold">
              {activeEventCount} ACTIVE
            </span>
          )}
          <span className="text-xs text-gold/60">{visibleEvents.length}</span>
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-gold/60 cursor-pointer select-none">
        <input type="checkbox" checked={showResolvedEvents} onChange={(e) => onToggleResolved(e.target.checked)} className="accent-gold" />
        Show resolved
      </label>
      <div className="space-y-2 max-h-44 overflow-y-auto scrollbar-thin">
        {fieldEventsLoading ? (
          <div className="text-xs text-gold/50">Loading events...</div>
        ) : visibleEvents.length === 0 ? (
          <div className="flex flex-col items-center py-4 text-gold/40 gap-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-xs">No active field events</p>
          </div>
        ) : (
          visibleEvents.map((ev) => {
            const cfg = EVENT_TYPE_CONFIG[ev.eventType] || { color: '#6b7280', label: ev.eventType, glyph: '?' };
            const isPending = respondingIds.has(ev._id);
            const canAck = ev.status === 'ACTIVE';
            const canResolve = ev.status === 'ACTIVE' || ev.status === 'ACKNOWLEDGED';
            return (
              <div key={ev._id} className="rounded-lg border border-gold/10 px-3 py-2 hover:border-gold/30 transition-colors">
                <div role="button" tabIndex={0} onClick={() => onFocusEvent(ev)} onKeyDown={(e) => e.key === 'Enter' && onFocusEvent(ev)} className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: cfg.color }}>{cfg.glyph}</span>
                    <span className="text-xs text-gold/80 font-semibold">{cfg.label}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE_CLASS[ev.status] ?? STATUS_BADGE_CLASS.RESOLVED}`}>{ev.status}</span>
                </div>
                <div className="text-[11px] text-gold/50 mt-0.5">{new Date(ev.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                {(canAck || canResolve) && (
                  <div className="flex gap-1.5 mt-2">
                    {canAck && <button type="button" disabled={isPending} onClick={() => onRespond(ev._id, 'acknowledge')} className="flex-1 text-[10px] font-semibold py-1 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-40 transition-colors">{isPending ? '…' : 'ACK'}</button>}
                    {canResolve && <button type="button" disabled={isPending} onClick={() => onRespond(ev._id, 'resolve')} className="flex-1 text-[10px] font-semibold py-1 rounded border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors">{isPending ? '…' : 'RESOLVE'}</button>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  </Card>
);

export default FieldEventsPanel;
