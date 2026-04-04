import React from 'react';

/**
 * AlertBanner — full-width contextual message bar.
 *
 * tone:      'warning' | 'error' | 'success' | 'info'
 * onDismiss: optional callback; renders an ✕ button when provided
 */
const toneClasses = {
  warning: 'border-gold/30 bg-gold/10 text-gold/80',
  error:   'border-red-500/40 bg-red-500/10 text-red-300',
  success: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  info:    'border-blue-400/40 bg-blue-400/10 text-blue-300',
};

const AlertBanner = ({ message, tone = 'warning', onDismiss, action, className = '' }) => {
  if (!message) return null;

  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${toneClasses[tone] ?? toneClasses.warning} ${className}`}
      role="alert"
    >
      <span className="flex-1 min-w-0">{message}</span>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        {action && (
          <button
            onClick={action.onClick}
            disabled={action.disabled}
            className="text-xs font-semibold px-2.5 py-1 rounded border border-current opacity-80 hover:opacity-100 disabled:opacity-40 transition-opacity"
          >
            {action.disabled ? '…' : action.label}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default AlertBanner;
