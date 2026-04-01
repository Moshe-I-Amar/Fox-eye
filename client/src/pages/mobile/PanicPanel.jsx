import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { eventApi } from '../../services/eventApi';

const BUTTONS = [
  {
    type:     'INJURED',
    label:    'INJURED',
    sublabel: 'פצוע — Patzua',
    bg:       'bg-red-700/80 hover:bg-red-600 active:bg-red-500',
    border:   'border-red-500/60',
    glow:     'shadow-[0_0_24px_rgba(239,68,68,0.4)]',
    confirmBg:'bg-red-900/40 border-red-500/30'
  },
  {
    type:     'AMBUSH',
    label:    'AMBUSH',
    sublabel: "מארב — Ma'arav",
    bg:       'bg-amber-600/80 hover:bg-amber-500 active:bg-amber-400',
    border:   'border-amber-500/60',
    glow:     'shadow-[0_0_24px_rgba(245,158,11,0.4)]',
    confirmBg:'bg-amber-900/40 border-amber-500/30'
  },
  {
    type:     'LINK_UP',
    label:    'LINK-UP',
    sublabel: 'חברת כוח — Havirat Koach',
    bg:       'bg-emerald-700/80 hover:bg-emerald-600 active:bg-emerald-500',
    border:   'border-emerald-500/60',
    glow:     'shadow-[0_0_24px_rgba(52,211,153,0.4)]',
    confirmBg:'bg-emerald-900/40 border-emerald-500/30'
  }
];

const FEEDBACK_DISMISS_MS = 5000;

/**
 * PanicPanel — one-touch field event reporting.
 *
 * Props:
 *   userCoordinates  {[lng, lat] | null}  — current GPS position
 *   disabled         {boolean}            — disable all buttons (e.g. while offline)
 *   onQueueEvent     {fn}                 — called with payload when offline; queues for retry
 *   queuedCount      {number}             — number of events pending in offline queue
 */
const PanicPanel = ({ userCoordinates, disabled = false, onQueueEvent, queuedCount = 0 }) => {
  const [pending,  setPending]  = useState(null);
  const [sending,  setSending]  = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Auto-dismiss feedback after FEEDBACK_DISMISS_MS
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), FEEDBACK_DISMISS_MS);
    return () => clearTimeout(t);
  }, [feedback]);

  const handlePress = useCallback((btn) => {
    if (disabled) return;
    navigator.vibrate?.([100, 50, 100]);
    setFeedback(null);
    setPending(btn);
  }, [disabled]);

  const handleConfirm = async () => {
    if (!pending) return;
    setSending(true);
    const payload = {
      eventType:   pending.type,
      coordinates: userCoordinates,
      timestamp:   new Date().toISOString()
    };
    try {
      await eventApi.createEvent(payload);
      navigator.vibrate?.(200);
      setFeedback({ type: 'success', message: `${pending.label} signal sent to command chain.` });
    } catch (err) {
      const isNetworkError = !navigator.onLine || !err.status;
      if (isNetworkError && onQueueEvent) {
        onQueueEvent(payload);
        setFeedback({ type: 'queued', message: `${pending.label} queued — will send when online.` });
      } else {
        setFeedback({ type: 'error', message: err.message || 'Failed to send signal. Try again.' });
      }
    } finally {
      setSending(false);
      setPending(null);
    }
  };

  const noGps = !userCoordinates;

  return (
    // flex-col + flex-1 on buttons = equal-height buttons that fill the screen
    <div className="flex flex-col p-4 gap-3 animate-fade-in">

      {/* GPS warning */}
      {noGps && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs shrink-0">
          <span className="text-base">◌</span>
          <span>Waiting for GPS lock — signal will include last known position</span>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 shrink-0">
        <p className="text-center text-[10px] text-gold/40 tracking-widest uppercase">
          Tap to send field signal
        </p>
        {queuedCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40
            text-[10px] text-amber-300 font-semibold tracking-wider whitespace-nowrap">
            {queuedCount} queued
          </span>
        )}
      </div>

      {/* Panic buttons — flex-1 so they fill remaining vertical space equally */}
      {BUTTONS.map((btn) => (
        <button
          key={btn.type}
          onClick={() => handlePress(btn)}
          disabled={disabled}
          aria-label={`Send ${btn.label} signal`}
          className={`w-full min-h-[5.5rem] rounded-xl border ${btn.bg} ${btn.border} ${btn.glow}
            text-white font-bold tracking-widest uppercase
            transition-all duration-150 select-none
            focus:outline-none focus:ring-2 focus:ring-gold
            disabled:opacity-40 disabled:cursor-not-allowed
            flex flex-col items-center justify-center gap-1
            text-xl sm:text-2xl`}
        >
          <span>{btn.label}</span>
          <span className="text-xs sm:text-sm font-normal opacity-70">{btn.sublabel}</span>
        </button>
      ))}

      {/* Feedback banner */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`shrink-0 text-center text-sm py-3 px-4 rounded-lg border transition-all animate-slide-up
            ${feedback.type === 'success'
              ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30'
              : feedback.type === 'queued'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-red-500/15 text-red-300 border-red-500/30'}`}
        >
          {feedback.message}
        </div>
      )}

      {/* Confirm modal */}
      <Modal
        isOpen={!!pending}
        onClose={() => !sending && setPending(null)}
        title="Confirm Signal"
        size="small"
        closeOnBackdrop={!sending}
      >
        {pending && (
          <div className="space-y-4">
            <div className={`rounded-lg border p-3 text-center ${pending.confirmBg}`}>
              <div className="text-xl font-bold text-white tracking-widest">{pending.label}</div>
              <div className="text-xs text-white/60 mt-0.5">{pending.sublabel}</div>
            </div>
            <p className="text-gold/70 text-sm text-center">
              This will alert your command chain immediately.
            </p>
            {noGps && (
              <p className="text-amber-300/80 text-xs text-center">
                No GPS — coordinates will be omitted.
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
};

export default PanicPanel;
