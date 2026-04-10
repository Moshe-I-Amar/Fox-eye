import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Modal from '../../components/ui/Modal';

// ── Slide-to-confirm rail ─────────────────────────────────────────────────────
const SlideToConfirm = ({ onConfirmed, disabled, onCancel }) => {
  const trackRef   = useRef(null);
  const [pct, setPct]           = useState(0);
  const [dragging, setDragging] = useState(false);
  const [locked,   setLocked]   = useState(false);
  const [countdown, setCount]   = useState(5);
  const timerRef   = useRef(null);
  const lockedRef  = useRef(false);
  const firedRef   = useRef(false);

  // Pointer event handlers (unified mouse + touch)
  const onDown = useCallback((e) => {
    if (disabled || lockedRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }, [disabled]);

  const onMove = useCallback((e) => {
    if (!dragging || !trackRef.current || lockedRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const HANDLE_W = 44;
    const maxTravel = rect.width - HANDLE_W;
    const raw = Math.min(1, Math.max(0, (e.clientX - rect.left - HANDLE_W / 2) / maxTravel));
    setPct(raw);
    if (raw >= 0.92 && !lockedRef.current) {
      lockedRef.current = true;
      setLocked(true);
      setPct(1);
    }
  }, [dragging]);

  const onUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    if (!lockedRef.current) setPct(0);
  }, [dragging]);

  // Countdown once locked
  useEffect(() => {
    if (!locked) return;
    firedRef.current = false;
    setCount(5);
    timerRef.current = setInterval(() => {
      setCount((n) => {
        if (n <= 1) { clearInterval(timerRef.current); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [locked]);

  // Fire onConfirmed once countdown reaches 0 — kept in a separate effect so it
  // never runs inside a setState updater (which would trigger React's
  // "update during render" warning and double-fire in StrictMode).
  useEffect(() => {
    if (locked && countdown === 0 && !firedRef.current) {
      firedRef.current = true;
      onConfirmed();
    }
  }, [locked, countdown, onConfirmed]);

  const cancel = () => {
    clearInterval(timerRef.current);
    lockedRef.current = false;
    setLocked(false);
    setPct(0);
    setCount(5);
    onCancel?.();
  };

  // Fill width: at pct=0 → handleWidth; at pct=1 → 100%
  const fillPct = `calc(${pct * 100}% + ${Math.round((1 - pct) * 44)}px)`;
  // Handle left: at pct=0 → 0; at pct=1 → trackWidth-44px
  const handleLeft = `calc(${pct * 100}% - ${Math.round(pct * 44)}px)`;

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        className="relative h-11 rounded-full overflow-hidden select-none border border-red-500/50"
        style={{ background: 'rgba(127,29,29,0.35)' }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-none"
          style={{ width: fillPct, background: locked ? 'rgba(220,38,38,0.85)' : 'rgba(185,28,28,0.6)' }}
        />
        {/* Label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="text-xs font-bold tracking-widest uppercase text-white/90 drop-shadow">
            {locked ? `Mobilizing in ${countdown}s…` : 'Slide to mobilize ▶'}
          </span>
        </div>
        {/* Handle */}
        {!locked && (
          <div
            className="absolute top-0 bottom-0 w-11 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20 touch-none"
            style={{ left: handleLeft, background: 'linear-gradient(135deg, #ef4444, #b91c1c)', boxShadow: '0 0 12px rgba(239,68,68,0.6)' }}
            onPointerDown={onDown}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        )}
      </div>
      {locked && (
        <button
          type="button"
          onClick={cancel}
          className="w-full text-center text-xs text-red-400/70 hover:text-red-400 transition-colors py-1"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

// ── Helper: authority check ────────────────────────────────────────────────────
const MOBILIZE_ROLES = ['TEAM_COMMANDER', 'COMPANY_COMMANDER', 'UNIT_COMMANDER', 'HQ'];

// ── Main modal ────────────────────────────────────────────────────────────────
const MobilizationModal = ({ isOpen, onClose, onConfirm, sending, currentUser, companyOptions = [], teamOptions = [], rallyPointDraft, onClearRallyPoint }) => {
  const isAdmin   = currentUser?.role === 'admin';
  const opRole    = currentUser?.operationalRole || '';
  const isTC      = opRole === 'TEAM_COMMANDER';
  const isCC      = opRole === 'COMPANY_COMMANDER';
  const isUCPlus  = ['UNIT_COMMANDER', 'HQ'].includes(opRole) || isAdmin;

  const [form, setForm] = useState({
    incidentDescription: '',
    rallyPointName: '',
    companyId: (isCC || isTC) ? (currentUser?.companyId || '') : '',
    teamId:    isTC            ? (currentUser?.teamId    || '') : '',
  });
  const [formError, setFormError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setForm({
      incidentDescription: '',
      rallyPointName: '',
      companyId: (isCC || isTC) ? (currentUser?.companyId || '') : '',
      teamId:    isTC            ? (currentUser?.teamId    || '') : '',
    });
    setFormError('');
  }, [isOpen, isCC, isTC, currentUser?.companyId, currentUser?.teamId]);

  // Scope options
  const availableCompanies = useMemo(() => {
    if (!isUCPlus) return [];
    const uid = currentUser?.unitId;
    if (!uid) return companyOptions;
    return companyOptions.filter((c) => c.parentId && String(c.parentId) === String(uid));
  }, [isUCPlus, companyOptions, currentUser?.unitId]);

  const availableTeams = useMemo(() => {
    if (isTC) return [];
    const cid = form.companyId;
    if (!cid) return [];
    return teamOptions.filter((t) => t.parentId && String(t.parentId) === String(cid));
  }, [isTC, teamOptions, form.companyId]);

  // When company changes, clear team selection
  const handleCompanyChange = (companyId) => {
    setForm((prev) => ({ ...prev, companyId, teamId: '' }));
  };

  const buildPayload = () => {
    const unitId = currentUser?.unitId;
    if (!unitId) { setFormError('Your account has no unit assigned.'); return null; }
    const targetScope = { unitId };
    if (form.companyId) targetScope.companyId = form.companyId;
    if (form.teamId)    targetScope.teamId    = form.teamId;
    return {
      targetScope,
      incidentDescription: form.incidentDescription.trim() || undefined,
      rallyPointName:      form.rallyPointName.trim() || rallyPointDraft?.name || undefined,
      rallyPoint: rallyPointDraft
        ? { type: 'Point', coordinates: rallyPointDraft.coordinates }
        : undefined,
    };
  };

  const handleConfirmed = useCallback(() => {
    const payload = buildPayload();
    if (!payload) return;
    onConfirm(payload);
  }, [form, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSlide = !sending && !formError;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mobilization Order" size="medium" closeOnBackdrop={false}>
      <div className="space-y-5">
        {/* Warning banner */}
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-red-300 text-sm leading-relaxed">
            This will issue an immediate unit-wide mobilization order and dispatch high-priority push alerts to all personnel in scope.
          </p>
        </div>

        {/* Scope */}
        <div className="space-y-3">
          <h4 className="text-xs uppercase tracking-widest text-gold/60 font-semibold">Target Scope</h4>

          {/* Company */}
          {isUCPlus ? (
            <div>
              <label className="block text-xs text-gold/70 mb-1">Company <span className="text-gold/40">(optional — leave blank for entire unit)</span></label>
              <select
                className="w-full rounded-lg border border-gold/20 bg-charcoal text-gold px-3 py-2 text-sm focus:outline-none focus:border-gold/50"
                value={form.companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
              >
                <option value="">All companies (unit-wide)</option>
                {availableCompanies.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-lg border border-gold/10 bg-gold/5 px-3 py-2 text-sm text-gold/70">
              Company: <span className="text-gold">{companyOptions.find((c) => String(c._id) === String(currentUser?.companyId))?.name || '—'}</span>
              <span className="ml-2 text-gold/30 text-xs">(locked to your company)</span>
            </div>
          )}

          {/* Team */}
          {!isTC && (
            <div>
              <label className="block text-xs text-gold/70 mb-1">Team <span className="text-gold/40">(optional — leave blank for entire company)</span></label>
              {availableTeams.length > 0 ? (
                <select
                  className="w-full rounded-lg border border-gold/20 bg-charcoal text-gold px-3 py-2 text-sm focus:outline-none focus:border-gold/50"
                  value={form.teamId}
                  onChange={(e) => setForm((prev) => ({ ...prev, teamId: e.target.value }))}
                  disabled={!form.companyId}
                >
                  <option value="">All teams in company</option>
                  {availableTeams.map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-gold/10 bg-gold/5 px-3 py-2 text-xs text-gold/40">
                  {form.companyId ? 'No teams found under this company.' : 'Select a company first.'}
                </div>
              )}
            </div>
          )}

          {isTC && (
            <div className="rounded-lg border border-gold/10 bg-gold/5 px-3 py-2 text-sm text-gold/70">
              Team: <span className="text-gold">{teamOptions.find((t) => String(t._id) === String(currentUser?.teamId))?.name || '—'}</span>
              <span className="ml-2 text-gold/30 text-xs">(locked to your team)</span>
            </div>
          )}
        </div>

        {/* Incident description */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-gold/60 font-semibold mb-2">Incident Description</label>
          <textarea
            className="w-full rounded-lg border border-gold/20 bg-charcoal text-gold placeholder-gold/30 px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold/50"
            rows={3}
            maxLength={500}
            placeholder="Brief description of the incident triggering this mobilization…"
            value={form.incidentDescription}
            onChange={(e) => setForm((prev) => ({ ...prev, incidentDescription: e.target.value }))}
          />
          <p className="text-xs text-gold/30 text-right mt-1">{form.incidentDescription.length}/500</p>
        </div>

        {/* Rally point location (from map picker) */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-gold/60 font-semibold mb-2">Rally Point Location</label>
          {rallyPointDraft ? (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2.5">
              {/* Pulsing dot */}
              <span className="relative flex-shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 block" />
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
              </span>
              <div className="flex-1 min-w-0">
                {rallyPointDraft.name && (
                  <p className="text-red-300 text-xs font-semibold truncate">{rallyPointDraft.name}</p>
                )}
                <p className="text-red-400/70 text-[11px] font-mono">
                  {rallyPointDraft.coordinates[1].toFixed(5)}, {rallyPointDraft.coordinates[0].toFixed(5)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClearRallyPoint}
                title="Clear rally point"
                className="text-red-400/50 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-gold/10 bg-gold/5 px-3 py-2.5 text-xs text-gold/40 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 flex-shrink-0 text-gold/30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
              </svg>
              Use the map search or drop-pin tool to set a GPS location
            </div>
          )}
        </div>

        {/* Rally point name */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-gold/60 font-semibold mb-2">Rally Point Name <span className="text-gold/30 normal-case">(override or descriptive label)</span></label>
          <input
            type="text"
            className="w-full rounded-lg border border-gold/20 bg-charcoal text-gold placeholder-gold/30 px-3 py-2 text-sm focus:outline-none focus:border-gold/50"
            maxLength={100}
            placeholder={rallyPointDraft?.name || 'e.g. Gate 4 car park, Building B entrance…'}
            value={form.rallyPointName}
            onChange={(e) => setForm((prev) => ({ ...prev, rallyPointName: e.target.value }))}
          />
        </div>

        {/* Form error */}
        {formError && (
          <p className="text-red-400 text-sm">{formError}</p>
        )}

        {/* Divider */}
        <div className="border-t border-gold/10" />

        {/* Slide to confirm */}
        <div>
          <p className="text-xs text-gold/50 mb-3 text-center">
            Drag the slider fully to the right to confirm and send the mobilization order.
          </p>
          {canSlide ? (
            <SlideToConfirm onConfirmed={handleConfirmed} disabled={sending} onCancel={() => {}} />
          ) : (
            <div className="h-11 rounded-full flex items-center justify-center border border-gold/20 bg-gold/5">
              <span className="text-xs text-gold/40 animate-pulse">Sending order…</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export { MOBILIZE_ROLES };
export default MobilizationModal;
