import React, { memo, useState, useCallback, useEffect } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { eventApi } from '../../../services/eventApi';

// ── Action definitions ────────────────────────────────────────────────────────
// Top row = SOS (critical, life-threatening). Bottom row = Contact (informational).
// Categories determine visual hierarchy: sos → strong glow, contact → subtle glow.
const GRID_ACTIONS = [
  // ── SOS ──────────────────────────────────────────────────────────────────
  {
    type:       'INJURED',
    label:      'INJURED',
    sublabel:   'פצוע',
    category:   'sos',
    icon:       '✚',
    bg:         'bg-red-800/70 hover:bg-red-700/90 active:bg-red-600',
    border:     'border-red-600/50',
    glow:       'shadow-[0_0_22px_rgba(239,68,68,0.40)]',
    confirmBg:  'bg-red-900/40 border-red-500/30',
  },
  {
    type:       'AMBUSH',
    label:      'AMBUSH',
    sublabel:   "מארב",
    category:   'sos',
    icon:       '⚠',
    bg:         'bg-amber-700/70 hover:bg-amber-600/90 active:bg-amber-500',
    border:     'border-amber-500/50',
    glow:       'shadow-[0_0_22px_rgba(245,158,11,0.38)]',
    confirmBg:  'bg-amber-900/40 border-amber-500/30',
  },
  // ── Contact ───────────────────────────────────────────────────────────────
  {
    type:       'LINK_UP',
    label:      'LINK-UP',
    sublabel:   'חברת כוח',
    category:   'contact',
    icon:       '↑',
    bg:         'bg-emerald-800/60 hover:bg-emerald-700/80 active:bg-emerald-600',
    border:     'border-emerald-600/40',
    glow:       'shadow-[0_0_16px_rgba(52,211,153,0.28)]',
    confirmBg:  'bg-emerald-900/40 border-emerald-500/30',
  },
  {
    type:       'VIEW_EVENTS',
    label:      'EVENTS',
    sublabel:   'Field feed',
    category:   'info',
    icon:       '≡',
    bg:         'bg-blue-900/40 hover:bg-blue-800/60 active:bg-blue-700/60',
    border:     'border-blue-500/30',
    glow:       '',
    confirmBg:  '',
  },
];

const FEEDBACK_DISMISS_MS = 4000;

/**
 * ReportingGrid — memoized 2×2 operational action grid.
 *
 * Top row: SOS actions (INJURED, AMBUSH) — largest visual weight, strong glow.
 * Bottom row: Contact actions (LINK_UP) + Events feed shortcut.
 *
 * Each SOS/Contact button sends a field event via REST + confirms via modal.
 * Haptic feedback fires on press (vibrate) and on successful send.
 * Offline sends are queued via onQueueEvent and displayed as a queued badge.
 *
 * Memoized — props rarely change, so this prevents the containing sheet from
 * causing redundant renders of the confirm modal tree.
 *
 * Props:
 *   userCoordinates {[lng, lat] | null}  — current GPS position (GeoJSON order)
 *   onQueueEvent    {fn}                 — enqueue payload when offline
 *   queuedCount     {number}             — # events pending in offline queue
 *   onViewEvents    {fn}                 — called when EVENTS shortcut pressed
 *   disabled        {boolean}            — disable all action buttons
 */
const ReportingGrid = memo(({
  userCoordinates,
  onQueueEvent,
  queuedCount = 0,
  onViewEvents,
  disabled = false,
}) => {
  const [pending,  setPending]  = useState(null);
  const [sending,  setSending]  = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Auto-dismiss feedback toast
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), FEEDBACK_DISMISS_MS);
    return () => clearTimeout(t);
  }, [feedback]);

  const handlePress = useCallback((action) => {
    if (disabled) return;

    if (action.type === 'VIEW_EVENTS') {
      navigator.vibrate?.(40);
      onViewEvents?.();
      return;
    }

    // Haptic: double-pulse for SOS, single for contact
    navigator.vibrate?.(action.category === 'sos' ? [80, 40, 80] : [60]);
    setFeedback(null);
    setPending(action);
  }, [disabled, onViewEvents]);

  const handleConfirm = async () => {
    if (!pending) return;
    setSending(true);
    const payload = {
      eventType:   pending.type,
      coordinates: userCoordinates,
      timestamp:   new Date().toISOString(),
    };
    try {
      await eventApi.createEvent(payload);
      navigator.vibrate?.(180);
      setFeedback({ type: 'success', message: `${pending.label} signal sent to command chain.` });
    } catch (err) {
      const isNetworkError = !navigator.onLine || !err.status;
      if (isNetworkError && onQueueEvent) {
        onQueueEvent(payload);
        setFeedback({ type: 'queued', message: `${pending.label} queued — will send when online.` });
      } else {
        setFeedback({ type: 'error', message: err.message || 'Send failed. Try again.' });
      }
    } finally {
      setSending(false);
      setPending(null);
    }
  };

  const noGps = !userCoordinates;

  return (
    <div className="px-3 pb-4 animate-fade-in">

      {/* ── Status bar: GPS state + offline queue badge ───────────────────── */}
      <div className="flex items-center justify-between mb-3 gap-2 h-5">
        {noGps ? (
          <span className="flex items-center gap-1.5 text-[10px] text-amber-300/70">
            <span>◌</span> Waiting for GPS lock
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/70">
            <span>◎</span> GPS ready
          </span>
        )}

        {queuedCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40
            text-[10px] text-amber-300 font-semibold tracking-wider whitespace-nowrap">
            {queuedCount} queued
          </span>
        )}
      </div>

      {/* ── 2×2 Action grid ───────────────────────────────────────────────── */}
      {/*
        SOS row (red/amber) rendered at larger visual weight than Contact row.
        Each cell: min-h-[80px] as required; font weight + glow differs by category.
      */}
      <div className="grid grid-cols-2 gap-2.5">
        {GRID_ACTIONS.map((action) => {
          const isSOS = action.category === 'sos';
          return (
            <button
              key={action.type}
              onClick={() => handlePress(action)}
              disabled={disabled}
              aria-label={
                action.type === 'VIEW_EVENTS'
                  ? 'View field events feed'
                  : `Send ${action.label} signal`
              }
              className={`
                min-h-[80px] rounded-xl border
                ${action.bg} ${action.border} ${action.glow}
                text-white tracking-widest uppercase
                transition-all duration-150 select-none
                focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-1 focus:ring-offset-jet
                disabled:opacity-40 disabled:cursor-not-allowed
                flex flex-col items-center justify-center gap-1
                ${isSOS ? 'font-bold' : 'font-semibold'}
              `}
            >
              <span className={`leading-none ${isSOS ? 'text-2xl' : 'text-xl'}`}>
                {action.icon}
              </span>
              <span className={`${isSOS ? 'text-[11px]' : 'text-[10px]'} font-bold`}>
                {action.label}
              </span>
              <span className="text-[9px] font-normal opacity-55">
                {action.sublabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Feedback toast ────────────────────────────────────────────────── */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-2.5 text-center text-xs py-2.5 px-3 rounded-lg border animate-slide-up
            ${feedback.type === 'success'
              ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30'
              : feedback.type === 'queued'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-red-500/15 text-red-300 border-red-500/30'}`}
        >
          {feedback.message}
        </div>
      )}

      {/* ── Confirm modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!pending}
        onClose={() => !sending && setPending(null)}
        title="Confirm Signal"
        size="small"
        closeOnBackdrop={!sending}
      >
        {pending && (
          <div className="space-y-4">
            <div className={`rounded-lg border p-4 text-center ${pending.confirmBg}`}>
              <div className="text-xl font-bold text-white tracking-widest">{pending.label}</div>
              <div className="text-xs text-white/60 mt-1">{pending.sublabel}</div>
            </div>
            <p className="text-gold/70 text-sm text-center">
              This will alert your command chain immediately.
            </p>
            {noGps && (
              <p className="text-amber-300/80 text-xs text-center">
                No GPS fix — coordinates will be omitted from the report.
              </p>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPending(null)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleConfirm}
                disabled={sending}
              >
                {sending ? 'Sending…' : 'Confirm Send'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
});

ReportingGrid.displayName = 'ReportingGrid';

export default ReportingGrid;
