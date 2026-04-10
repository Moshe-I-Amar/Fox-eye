import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import L from 'leaflet';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import { EVENT_TYPE_CONFIG, STATUS_BADGE_CLASS, svgToDataUrl } from '../../utils/markerUtils';

const SPIDER_RADIUS_PX = 90;

// ── Cluster badge SVG ─────────────────────────────────────────────────────────
const buildEventClusterSvg = (count, hasActive) => {
  const color = hasActive ? '#ef4444' : '#C7A76C';
  const label = count > 99 ? '99+' : String(count);
  const fs = count > 9 ? 11 : 14;
  return `<svg width="44" height="44" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><filter id="ecbf" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.65)"/></filter></defs><circle cx="28" cy="28" r="27" fill="${color}" fill-opacity="0.18" filter="url(#ecbf)"/><circle cx="28" cy="28" r="20" fill="${color}"/><circle cx="28" cy="28" r="20" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2.5"/><circle cx="28" cy="28" r="26.5" fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="0.45"/><text x="28" y="28" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="700" fill="white" font-family="'Segoe UI',Arial,sans-serif" letter-spacing="0.5">${label}</text></svg>`;
};

// ── Individual event card at a spider leaf position ───────────────────────────
const EventLeafCard = ({ event, px, py, onRespond, isPending }) => {
  const cfg = EVENT_TYPE_CONFIG[event.eventType] || { color: '#6b7280', label: event.eventType, glyph: '?' };
  const canAck = event.status === 'ACTIVE';
  const canResolve = event.status === 'ACTIVE' || event.status === 'ACKNOWLEDGED';
  const statusCls = STATUS_BADGE_CLASS[event.status] ?? STATUS_BADGE_CLASS.RESOLVED;
  const senderName = event.senderId?.name || '';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: px,
        top: py,
        transform: 'translate(-50%, -50%)',
        zIndex: 752,
        pointerEvents: 'auto',
        width: 172,
      }}
    >
      <div
        style={{ background: 'rgba(26,26,26,0.97)', border: '1px solid rgba(199,167,108,0.2)', borderRadius: 8, padding: '10px', boxShadow: '0 0 12px rgba(199,167,108,0.12)', backdropFilter: 'blur(8px)' }}
      >
        {/* Header: glyph + label + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: senderName ? 6 : (canAck || canResolve) ? 8 : 0 }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: '50%', backgroundColor: cfg.color,
              fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}
          >
            {cfg.glyph}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cfg.label}
          </span>
          <span style={{ fontSize: 9, padding: '2px 4px', borderRadius: 4, fontWeight: 600, flexShrink: 0 }} className={statusCls}>
            {event.status}
          </span>
        </div>

        {/* Sender name */}
        {senderName && (
          <div style={{ fontSize: 10, color: 'rgba(199,167,108,0.5)', marginBottom: (canAck || canResolve) ? 8 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {senderName}
          </div>
        )}

        {/* Action buttons */}
        {(canAck || canResolve) && (
          <div style={{ display: 'flex', gap: 4 }}>
            {canAck && (
              <button
                type="button"
                disabled={isPending}
                onClick={(e) => { e.stopPropagation(); onRespond(event._id, 'acknowledge'); }}
                style={{
                  flex: 1, fontSize: 10, fontWeight: 600, padding: '4px 0', borderRadius: 4,
                  border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24',
                  background: 'transparent', cursor: isPending ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.4 : 1, transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {isPending ? '…' : 'ACK'}
              </button>
            )}
            {canResolve && (
              <button
                type="button"
                disabled={isPending}
                onClick={(e) => { e.stopPropagation(); onRespond(event._id, 'resolve'); }}
                style={{
                  flex: 1, fontSize: 10, fontWeight: 600, padding: '4px 0', borderRadius: 4,
                  border: '1px solid rgba(16,185,129,0.4)', color: '#34d399',
                  background: 'transparent', cursor: isPending ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.4 : 1, transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {isPending ? '…' : 'RESOLVE'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Spider overlay — portaled into the Leaflet map container ──────────────────
const SpiderOverlay = ({ center, events, spiderLatLngs, onRespond, respondingIds, onClose }) => {
  const map = useMap();
  const [pts, setPts] = useState(null);

  const update = useCallback(() => {
    const cp = map.latLngToContainerPoint(center);
    const leaves = spiderLatLngs.map((ll) => {
      const p = map.latLngToContainerPoint(ll);
      return { x: p.x, y: p.y };
    });
    setPts({ cx: cp.x, cy: cp.y, leaves });
  }, [map, center, spiderLatLngs]);

  useEffect(() => { update(); }, [update]);
  // Update card pixel positions as the map pans
  useMapEvents({ move: update });

  if (!pts) return null;

  return ReactDOM.createPortal(
    <div style={{ position: 'absolute', inset: 0, zIndex: 748, pointerEvents: 'none' }}>
      {/* Invisible backdrop — click anywhere outside cards to close */}
      <div
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', zIndex: 748 }}
        onClick={onClose}
      />

      {/* Spider arm lines */}
      <svg
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 750, overflow: 'visible',
        }}
      >
        {pts.leaves.map((leaf, i) => {
          const ev = events[i];
          const color = (EVENT_TYPE_CONFIG[ev?.eventType] || {}).color || '#C7A76C';
          return (
            <line
              key={ev?._id || i}
              x1={pts.cx} y1={pts.cy}
              x2={leaf.x} y2={leaf.y}
              stroke={color}
              strokeWidth={2}
              strokeOpacity={0.7}
              strokeDasharray="5 3"
            />
          );
        })}
      </svg>

      {/* Event leaf cards */}
      {pts.leaves.map((leaf, i) => {
        const ev = events[i];
        if (!ev) return null;
        return (
          <EventLeafCard
            key={ev._id}
            event={ev}
            px={leaf.x}
            py={leaf.y}
            onRespond={onRespond}
            isPending={respondingIds.has(ev._id)}
          />
        );
      })}
    </div>,
    map.getContainer()
  );
};

// ── Main EventClusterSpider component ─────────────────────────────────────────
/**
 * Renders a circular cluster badge for 2+ co-located field events.
 * Click to spider-expand: radial dashed lines + individual event cards with
 * ACK / RESOLVE action buttons. Click anywhere outside the cards to collapse.
 *
 * Props:
 *   events        – array of field event objects (all at the same location)
 *   position      – [lat, lng] of the cluster center
 *   onRespond     – (id, 'acknowledge' | 'resolve') → void
 *   respondingIds – Set<string> of in-flight event IDs
 */
const EventClusterSpider = ({ events, position, onRespond, respondingIds }) => {
  const map = useMap();
  const [expanded, setExpanded] = useState(false);

  // Collapse automatically when the user starts zooming
  useMapEvents({ zoomstart: () => setExpanded(false) });

  const handleClick = useCallback((e) => {
    L.DomEvent.stopPropagation(e.originalEvent ?? e);
    setExpanded((prev) => !prev);
  }, []);

  // Compute spider leaf lat/lng positions at expansion time
  const spiderLatLngs = useMemo(() => {
    if (!expanded || events.length === 0) return [];
    const cp = map.latLngToContainerPoint(position);
    return events.map((_, i) => {
      const angle = ((360 / events.length) * i - 90) * (Math.PI / 180);
      const px = cp.x + SPIDER_RADIUS_PX * Math.cos(angle);
      const py = cp.y + SPIDER_RADIUS_PX * Math.sin(angle);
      return map.containerPointToLatLng(L.point(px, py));
    });
  }, [expanded, events, position, map]);

  const hasActive = events.some((e) => e.status === 'ACTIVE');

  const clusterIcon = useMemo(
    () =>
      new L.Icon({
        iconUrl: svgToDataUrl(buildEventClusterSvg(events.length, hasActive)),
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -24],
      }),
    [events.length, hasActive]
  );

  return (
    <>
      <Marker
        position={position}
        icon={clusterIcon}
        zIndexOffset={expanded ? 800 : 600}
        eventHandlers={{ click: handleClick }}
      />
      {expanded && (
        <SpiderOverlay
          center={position}
          events={events}
          spiderLatLngs={spiderLatLngs}
          onRespond={onRespond}
          respondingIds={respondingIds}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
};

export default EventClusterSpider;
