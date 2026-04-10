import React, { useState, useRef, useCallback, useEffect } from 'react';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEBOUNCE_MS   = 400;

/** Average the outer ring of a GeoJSON polygon → [lng, lat] centroid */
const getAoCentroid = (ao) => {
  const ring = ao.polygon?.coordinates?.[0];
  if (!ring || ring.length === 0) return null;
  const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
  const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  return [lng, lat];
};

const RallyPointSearch = ({
  aos = [],
  onSelect,       // ({ coordinates, name }) → actually commits the RP draft
  onFlyTo,        // ([lng, lat]) → pan/zoom map to preview location
  rallyPointDraft,
  onClear,
  canMobilize = false,
  rpPickerActive = false,
  onTogglePicker,
}) => {
  const [query,         setQuery]         = useState('');
  const [results,       setResults]       = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [open,          setOpen]          = useState(false);
  const [previewResult, setPreviewResult] = useState(null); // result shown on map, not yet committed

  const debounceRef  = useRef(null);
  const inputRef     = useRef(null);
  const containerRef = useRef(null);

  // Clear preview if a new RP draft is committed externally (e.g. drop-pin)
  useEffect(() => {
    if (rallyPointDraft) setPreviewResult(null);
  }, [rallyPointDraft]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return; }

    // Instant local AO search
    const aoResults = aos
      .filter((ao) => ao.active && ao.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 3)
      .map((ao) => {
        const centroid = getAoCentroid(ao);
        return centroid ? { type: 'ao', name: ao.name, label: ao.name, coordinates: centroid } : null;
      })
      .filter(Boolean);

    setLoading(true);
    try {
      const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=0`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      const nominatimResults = data.map((r) => ({
        type: 'place',
        name:  r.display_name.split(',').slice(0, 2).join(',').trim(),
        label: r.display_name,
        coordinates: [parseFloat(r.lon), parseFloat(r.lat)],
      }));
      setResults([...aoResults, ...nominatimResults]);
      setOpen(true);
    } catch {
      setResults(aoResults);
      setOpen(aoResults.length > 0);
    } finally {
      setLoading(false);
    }
  }, [aos]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setPreviewResult(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), DEBOUNCE_MS);
  };

  /** Step 1 — fly to location and show confirm card; do NOT commit RP yet */
  const handleResultClick = (result) => {
    onFlyTo?.(result.coordinates);   // pan map
    setPreviewResult(result);         // show confirm card
    setOpen(false);                   // close dropdown
    setQuery('');                     // clear input
    setResults([]);
  };

  /** Step 2 — commander confirms; now commit the RP */
  const handleConfirmRP = () => {
    if (!previewResult) return;
    onSelect({ coordinates: previewResult.coordinates, name: previewResult.name });
    setPreviewResult(null);
  };

  const handleDismissPreview = () => setPreviewResult(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setPreviewResult(null);
      inputRef.current?.blur();
    }
    if (e.key === 'Enter' && results.length > 0) handleResultClick(results[0]);
  };

  return (
    <div ref={containerRef} className="absolute top-3 left-3 z-[900] w-72">
      {/* ── Search input ── */}
      <div className="relative flex items-center">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading ? (
            <svg className="w-4 h-4 text-gold/60 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gold/50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search location or AO…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm bg-charcoal/95 border border-gold/30 text-gold placeholder-gold/30 focus:outline-none focus:border-gold/60 shadow-lg backdrop-blur-sm"
        />
      </div>

      {/* ── Results dropdown ── */}
      {open && results.length > 0 && (
        <div className="mt-1 rounded-lg border border-gold/20 bg-charcoal/98 shadow-xl backdrop-blur-sm overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleResultClick(r)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gold/10 transition-colors group border-b border-gold/10 last:border-0"
            >
              {r.type === 'ao' ? (
                <span className="flex-shrink-0 text-[10px] font-bold text-gold/80 bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wide">AO</span>
              ) : (
                <svg className="w-3.5 h-3.5 text-gold/50 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-gold text-xs font-medium truncate">{r.name}</p>
                {r.label !== r.name && (
                  <p className="text-gold/35 text-[10px] truncate">{r.label.split(',').slice(2, 4).join(',').trim()}</p>
                )}
              </div>
              <svg className="w-3.5 h-3.5 text-gold/30 group-hover:text-gold/60 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* ── Preview confirm card (location found, not yet set as RP) ── */}
      {previewResult && !rallyPointDraft && (
        <div className="mt-1.5 rounded-lg border border-gold/30 bg-charcoal/95 shadow-xl backdrop-blur-sm overflow-hidden">
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-[10px] uppercase tracking-widest text-gold/40 font-semibold mb-1">Location found</p>
            <p className="text-gold text-xs font-semibold leading-snug truncate">{previewResult.name}</p>
            {previewResult.label !== previewResult.name && (
              <p className="text-gold/40 text-[10px] truncate mt-0.5">
                {previewResult.label.split(',').slice(2, 4).join(',').trim()}
              </p>
            )}
          </div>
          <div className="flex border-t border-gold/10">
            <button
              type="button"
              onClick={handleDismissPreview}
              className="flex-1 py-2 text-xs text-gold/40 hover:text-gold/70 hover:bg-gold/5 transition-colors border-r border-gold/10"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleConfirmRP}
              className="flex-1 py-2 text-xs font-semibold text-red-300 hover:text-red-200 hover:bg-red-950/50 transition-colors"
            >
              Set as Rally Point
            </button>
          </div>
        </div>
      )}

      {/* ── Drop-pin button (shown when canMobilize and no RP/preview active) ── */}
      {canMobilize && !rallyPointDraft && !previewResult && (
        <button
          type="button"
          onClick={onTogglePicker}
          title={rpPickerActive ? 'Cancel map pick' : 'Click map to set rally point'}
          className={`mt-1.5 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-all ${
            rpPickerActive
              ? 'bg-red-900/70 border-red-500/60 text-red-300 shadow-lg shadow-red-900/30'
              : 'bg-charcoal/90 border-gold/20 text-gold/60 hover:border-gold/40 hover:text-gold/80 backdrop-blur-sm shadow'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
          {rpPickerActive ? 'Click map to place RP…' : 'Drop pin on map'}
        </button>
      )}

      {/* ── Committed rally point badge ── */}
      {rallyPointDraft && (
        <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/80 border border-red-500/40 backdrop-blur-sm shadow">
          <span className="relative flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-500 block" />
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
          </span>
          <p className="text-red-300 text-xs font-medium truncate flex-1 min-w-0">
            RP: {rallyPointDraft.name
              ? rallyPointDraft.name
              : `${rallyPointDraft.coordinates[1].toFixed(4)}, ${rallyPointDraft.coordinates[0].toFixed(4)}`}
          </p>
          <button
            type="button"
            onClick={onClear}
            title="Clear rally point"
            className="text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default RallyPointSearch;
