import React from 'react';
import Card from '../../components/ui/Card';
import { formatTimestamp, formatViolationType } from '../../utils/formatUtils';

const ViolationsPanel = ({ violations, violationLoading, violationError, violationFilters, onFilterChange, companyOptions, hierarchyMap, onFocusViolation }) => (
  <Card className="mb-6" padding="small">
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gold">Violation History</h3>
        <span className="text-xs text-gold/60">{violations.length} recent</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select className="dark-input w-full text-xs" value={violationFilters.severity} onChange={(e) => onFilterChange({ severity: e.target.value })}>
          <option value="all">All severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select className="dark-input w-full text-xs" value={violationFilters.companyId} onChange={(e) => onFilterChange({ companyId: e.target.value })}>
          <option value="">All companies</option>
          {companyOptions.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <input type="date" className="dark-input w-full text-xs" value={violationFilters.start} onChange={(e) => onFilterChange({ start: e.target.value })} />
        <input type="date" className="dark-input w-full text-xs" value={violationFilters.end} onChange={(e) => onFilterChange({ end: e.target.value })} />
      </div>
      {violationError && <p className="text-xs text-red-400">{violationError}</p>}
      <div className="space-y-2 max-h-44 overflow-y-auto scrollbar-thin">
        {violationLoading ? (
          <div className="text-xs text-gold/50">Loading violations...</div>
        ) : violations.length === 0 ? (
          <div className="flex flex-col items-center py-4 text-gold/40 gap-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-xs">No violations recorded</p>
          </div>
        ) : (
          violations.map((v) => (
            <button key={v._id} type="button" onClick={() => onFocusViolation(v)} className="w-full text-left rounded-lg border border-gold/10 px-3 py-2 hover:border-gold/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gold/80 font-semibold">{formatViolationType(v.type)}</span>
                <span className="text-[11px] text-gold/50">{formatTimestamp(v.occurredAt)}</span>
              </div>
              <div className="text-[11px] text-gold/50 mt-1">
                {v.aoName || 'Unknown AO'} • {hierarchyMap.companies[v.companyId]?.name || 'Company'}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  </Card>
);

export default ViolationsPanel;
