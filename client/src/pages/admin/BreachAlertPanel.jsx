import React from 'react';
import { formatTimestamp } from '../../utils/formatUtils';

const BreachAlertPanel = ({ breachAlerts }) => {
  if (breachAlerts.length === 0) return null;
  return (
    <div className="px-6 pt-4">
      <div className="space-y-2">
        {breachAlerts.map((alert) => (
          <div key={alert.id} className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">AO breach: {alert.name}</div>
              <div className="text-xs text-red-200/80">{formatTimestamp(alert.timestamp)}</div>
            </div>
            <div className="text-xs text-red-200/70">
              Last safe AO: {alert.aoName} · Grace {Math.round((alert.graceMs || 0) / 1000)}s · Tolerance {alert.toleranceMeters || 0}m
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BreachAlertPanel;
