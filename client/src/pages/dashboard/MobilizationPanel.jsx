import React, { useState, useCallback } from 'react';

const PHASE_LABELS = {
  ACTIVE:      'Alert Sent',
  TRANSIT:     'En Route to RP',
  PREPARATION: 'At Rally Point',
  DEPLOYMENT:  'Deployed',
  STOOD_DOWN:  'Stood Down',
};

const PHASE_NEXT_LABEL = {
  ACTIVE:      'Mark En Route',
  TRANSIT:     'Mark At RP',
  PREPARATION: 'Deploy Force',
};

const PHASE_ORDER = ['ACTIVE', 'TRANSIT', 'PREPARATION', 'DEPLOYMENT'];

const StatusBadge = ({ status }) => {
  const colors = {
    ACTIVE:      'bg-red-900/60 text-red-300 border-red-500/40',
    TRANSIT:     'bg-amber-900/60 text-amber-300 border-amber-500/40',
    PREPARATION: 'bg-yellow-900/60 text-yellow-300 border-yellow-500/40',
    DEPLOYMENT:  'bg-green-900/60 text-green-300 border-green-500/40',
    STOOD_DOWN:  'bg-gray-800/60 text-gray-400 border-gray-600/40',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold uppercase tracking-wider ${colors[status] || colors.ACTIVE}`}>
      {PHASE_LABELS[status] || status}
    </span>
  );
};

// ── Active mobilization card ──────────────────────────────────────────────────
const ActiveMobilizationCard = ({ mob, sending, onAdvance, onStandDown }) => {
  const [confirmStandDown, setConfirmStandDown] = useState(false);
  const canAdvance = PHASE_NEXT_LABEL[mob.status];

  const handleStandDown = useCallback(() => {
    if (!confirmStandDown) { setConfirmStandDown(true); return; }
    setConfirmStandDown(false);
    onStandDown(mob._id);
  }, [confirmStandDown, mob._id, onStandDown]);

  const scopeLabel = (() => {
    if (mob.targetScope?.teamId)    return 'Team-level';
    if (mob.targetScope?.companyId) return 'Company-level';
    return 'Unit-wide';
  })();

  return (
    <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex-shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 block" />
            {mob.status !== 'STOOD_DOWN' && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />}
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-red-300">Mobilization Active</span>
        </div>
        <span className="text-xs text-red-400/60 flex-shrink-0">{scopeLabel}</span>
      </div>

      <StatusBadge status={mob.status} />

      {mob.incidentDescription && (
        <p className="text-xs text-gold/70 line-clamp-2 leading-relaxed">{mob.incidentDescription}</p>
      )}
      {mob.rallyPointName && (
        <p className="text-xs text-gold/60"><span className="text-gold/40">Rally: </span>{mob.rallyPointName}</p>
      )}

      {/* Phase progress dots */}
      {mob.status !== 'STOOD_DOWN' && (
        <div className="flex items-center gap-1">
          {PHASE_ORDER.map((phase, i) => {
            const currentIdx = PHASE_ORDER.indexOf(mob.status);
            const done   = i < currentIdx;
            const active = i === currentIdx;
            return (
              <React.Fragment key={phase}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-red-400' : active ? 'bg-red-500 ring-2 ring-red-500/40' : 'bg-red-900/60'}`} />
                {i < PHASE_ORDER.length - 1 && <div className={`flex-1 h-px ${done ? 'bg-red-500/50' : 'bg-red-900/40'}`} />}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Actions */}
      {mob.status !== 'STOOD_DOWN' && (
        <div className="space-y-2 pt-1">
          {canAdvance && (
            <button
              type="button"
              disabled={sending}
              onClick={() => onAdvance(mob._id, PHASE_ORDER[PHASE_ORDER.indexOf(mob.status) + 1])}
              className="w-full rounded-lg border border-amber-500/40 bg-amber-900/30 text-amber-300 text-xs font-semibold py-2 hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wide"
            >
              {sending ? 'Updating…' : PHASE_NEXT_LABEL[mob.status]}
            </button>
          )}
          <button
            type="button"
            disabled={sending}
            onClick={handleStandDown}
            className={`w-full rounded-lg border text-xs font-semibold py-2 transition-colors uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed
              ${confirmStandDown
                ? 'border-red-500/80 bg-red-900/60 text-red-200 hover:bg-red-800/70'
                : 'border-red-500/30 bg-transparent text-red-400/70 hover:text-red-400 hover:border-red-500/50'}`}
          >
            {sending ? 'Updating…' : confirmStandDown ? 'Confirm Stand Down' : 'Stand Down'}
          </button>
          {confirmStandDown && (
            <button type="button" onClick={() => setConfirmStandDown(false)} className="w-full text-center text-xs text-gold/40 hover:text-gold/60 py-1 transition-colors">
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main panel ────────────────────────────────────────────────────────────────
const MobilizationPanel = ({
  activeMobilization,
  mobilizationLoading,
  mobilizationError,
  mobilizationSending,
  canMobilize,
  onOpenModal,
  onAdvance,
  onStandDown,
}) => {
  if (mobilizationLoading) {
    return (
      <div className="mb-4 rounded-lg border border-gold/10 bg-gold/5 p-3 animate-pulse h-16" />
    );
  }

  // If there's an active (non-stood-down) mobilization, show the status card
  if (activeMobilization && activeMobilization.status !== 'STOOD_DOWN') {
    return (
      <div className="mb-4 space-y-2">
        {mobilizationError && <p className="text-red-400 text-xs">{mobilizationError}</p>}
        <ActiveMobilizationCard
          mob={activeMobilization}
          sending={mobilizationSending}
          onAdvance={onAdvance}
          onStandDown={onStandDown}
        />
      </div>
    );
  }

  // No active mobilization — show trigger button only if user can mobilize
  if (!canMobilize) return null;

  return (
    <div className="mb-4 space-y-2">
      {mobilizationError && <p className="text-red-400 text-xs">{mobilizationError}</p>}
      <button
        type="button"
        onClick={onOpenModal}
        className="group w-full rounded-lg border border-red-500/50 bg-red-950/30 hover:bg-red-950/60 hover:border-red-500/80 transition-all px-4 py-3 flex items-center justify-center gap-3"
        style={{ boxShadow: '0 0 16px rgba(239,68,68,0.08)' }}
      >
        {/* Pulsing icon */}
        <span className="relative flex-shrink-0">
          <span className="w-3 h-3 rounded-full bg-red-500 block" />
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-70 group-hover:opacity-100" />
        </span>
        <span className="text-sm font-bold uppercase tracking-widest text-red-400 group-hover:text-red-300 transition-colors">
          Mobilize
        </span>
        <svg className="w-4 h-4 text-red-500/70 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </button>
    </div>
  );
};

export default MobilizationPanel;
