import React, { memo, useState, useCallback, useEffect } from 'react';
import { eventApi } from '../../../services/eventApi';
import SignalConfirmModal from './SignalConfirmModal';

const GRID_ACTIONS = [
  { type: 'INJURED',     label: 'INJURED', sublabel: 'פצוע',       category: 'sos',     icon: '✚', bg: 'bg-red-800/70 hover:bg-red-700/90 active:bg-red-600',         border: 'border-red-600/50',     glow: 'shadow-[0_0_22px_rgba(239,68,68,0.40)]',    confirmBg: 'bg-red-900/40 border-red-500/30' },
  { type: 'AMBUSH',      label: 'AMBUSH',  sublabel: 'מארב',        category: 'sos',     icon: '⚠', bg: 'bg-amber-700/70 hover:bg-amber-600/90 active:bg-amber-500',    border: 'border-amber-500/50',   glow: 'shadow-[0_0_22px_rgba(245,158,11,0.38)]',   confirmBg: 'bg-amber-900/40 border-amber-500/30' },
  { type: 'LINK_UP',     label: 'LINK-UP', sublabel: 'חברת כוח',   category: 'contact', icon: '↑', bg: 'bg-emerald-800/60 hover:bg-emerald-700/80 active:bg-emerald-600', border: 'border-emerald-600/40', glow: 'shadow-[0_0_16px_rgba(52,211,153,0.28)]',   confirmBg: 'bg-emerald-900/40 border-emerald-500/30' },
  { type: 'VIEW_EVENTS', label: 'EVENTS',  sublabel: 'Field feed',  category: 'info',    icon: '≡', bg: 'bg-blue-900/40 hover:bg-blue-800/60 active:bg-blue-700/60',    border: 'border-blue-500/30',    glow: '',                                          confirmBg: '' },
];

const FEEDBACK_DISMISS_MS = 4000;

const ActionButton = ({ action, disabled, onClick }) => {
  const isSOS = action.category === 'sos';
  return (
    <button onClick={() => onClick(action)} disabled={disabled}
      aria-label={action.type === 'VIEW_EVENTS' ? 'View field events feed' : `Send ${action.label} signal`}
      className={`min-h-[80px] rounded-xl border ${action.bg} ${action.border} ${action.glow} text-white tracking-widest uppercase transition-all duration-150 select-none focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-1 focus:ring-offset-jet disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 ${isSOS ? 'font-bold' : 'font-semibold'}`}>
      <span className={`leading-none ${isSOS ? 'text-2xl' : 'text-xl'}`}>{action.icon}</span>
      <span className={`${isSOS ? 'text-[11px]' : 'text-[10px]'} font-bold`}>{action.label}</span>
      <span className="text-[9px] font-normal opacity-55">{action.sublabel}</span>
    </button>
  );
};

const ReportingGrid = memo(({ userCoordinates, onQueueEvent, queuedCount = 0, onViewEvents, disabled = false }) => {
  const [pending,  setPending]  = useState(null);
  const [sending,  setSending]  = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), FEEDBACK_DISMISS_MS);
    return () => clearTimeout(t);
  }, [feedback]);

  const handlePress = useCallback((action) => {
    if (disabled) return;
    if (action.type === 'VIEW_EVENTS') { navigator.vibrate?.(40); onViewEvents?.(); return; }
    navigator.vibrate?.(action.category === 'sos' ? [80, 40, 80] : [60]);
    setFeedback(null);
    setPending(action);
  }, [disabled, onViewEvents]);

  const handleConfirm = async () => {
    if (!pending) return;
    setSending(true);
    const payload = { eventType: pending.type, coordinates: userCoordinates, timestamp: new Date().toISOString() };
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
    } finally { setSending(false); setPending(null); }
  };

  const noGps = !userCoordinates;

  return (
    <div className="px-3 pb-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3 gap-2 h-5">
        {noGps
          ? <span className="flex items-center gap-1.5 text-[10px] text-amber-300/70"><span>◌</span> Waiting for GPS lock</span>
          : <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/70"><span>◎</span> GPS ready</span>}
        {queuedCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] text-amber-300 font-semibold tracking-wider whitespace-nowrap">
            {queuedCount} queued
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {GRID_ACTIONS.map((action) => <ActionButton key={action.type} action={action} disabled={disabled} onClick={handlePress} />)}
      </div>

      {feedback && (
        <div role="status" aria-live="polite"
          className={`mt-2.5 text-center text-xs py-2.5 px-3 rounded-lg border animate-slide-up ${feedback.type === 'success' ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' : feedback.type === 'queued' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-red-500/15 text-red-300 border-red-500/30'}`}>
          {feedback.message}
        </div>
      )}

      <SignalConfirmModal
        pending={pending}
        sending={sending}
        noGps={noGps}
        onClose={() => !sending && setPending(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
});

ReportingGrid.displayName = 'ReportingGrid';
export default ReportingGrid;
