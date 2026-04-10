import React from 'react';
import Card from '../../components/ui/Card';
import AOPanel from './AOPanel';
import FieldEventsPanel from './FieldEventsPanel';
import ViolationsPanel from './ViolationsPanel';
import MobilizationPanel from './MobilizationPanel';

const DashboardSidebar = ({
  isOpen, realtimeEnabled, users, loading, radius, locationLoading, locationError,
  onRadiusChange, onSelectUser,
  aos, aoLoading, aoError, canManageAOs, getCompanyIdentity, onSelectAO, onToggleAOActive, onDeleteAO,
  visibleEvents, activeEventCount, fieldEventsLoading, showResolvedEvents, onToggleResolved,
  respondingIds, onRespond, onFocusEvent,
  canViewViolations, violations, violationLoading, violationError, violationFilters,
  onViolationFilterChange, companyOptions, hierarchyMap, onFocusViolation,
  canMobilize, activeMobilization, mobilizationLoading, mobilizationSending, mobilizationError,
  onOpenMobilizeModal, onAdvanceMobilization, onStandDownMobilization,
}) => (
  <div className={`${isOpen ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 glass-card border-b lg:border-b-0 lg:border-r border-gold/20 p-6 overflow-hidden flex-col lg:h-full max-h-[60vh] lg:max-h-none`}>
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-bold text-gold">Nearby Users</h2>
      <div className="flex items-center space-x-2">
        {realtimeEnabled && <div className="flex items-center space-x-1"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /><span className="text-xs text-green-400">Live</span></div>}
        <span className="text-sm text-gold/60 bg-gold/10 px-3 py-1 rounded-full">{users.length} found</span>
      </div>
    </div>

    <Card className="mb-6" padding="small">
      <div className="space-y-4">
        <div className="rounded-lg border border-gold/20 bg-gold/10 px-3 py-2 text-xs text-gold/80">
          {locationLoading ? 'Detecting your live location…' : 'Live location updates are active.'}
        </div>
        {locationError && <p className="text-red-400 text-sm">{locationError}</p>}
        <div className="space-y-2">
          <label className="text-sm text-gold">Search Radius: {radius} km</label>
          <input type="range" min="1" max="50" value={radius} onChange={(e) => onRadiusChange(Number(e.target.value))} className="w-full accent-gold" />
        </div>
      </div>
    </Card>

    <MobilizationPanel
      canMobilize={canMobilize}
      activeMobilization={activeMobilization}
      mobilizationLoading={mobilizationLoading}
      mobilizationSending={mobilizationSending}
      mobilizationError={mobilizationError}
      onOpenModal={onOpenMobilizeModal}
      onAdvance={onAdvanceMobilization}
      onStandDown={onStandDownMobilization}
    />
    <AOPanel aos={aos} aoLoading={aoLoading} aoError={aoError} canManageAOs={canManageAOs} getCompanyIdentity={getCompanyIdentity} onSelectAO={onSelectAO} onToggleAOActive={onToggleAOActive} onDeleteAO={onDeleteAO} />
    <FieldEventsPanel visibleEvents={visibleEvents} activeEventCount={activeEventCount} fieldEventsLoading={fieldEventsLoading} showResolvedEvents={showResolvedEvents} onToggleResolved={onToggleResolved} respondingIds={respondingIds} onRespond={onRespond} onFocusEvent={onFocusEvent} />
    {canViewViolations && <ViolationsPanel violations={violations} violationLoading={violationLoading} violationError={violationError} violationFilters={violationFilters} onFilterChange={(patch) => onViolationFilterChange((prev) => ({ ...prev, ...patch }))} companyOptions={companyOptions} hierarchyMap={hierarchyMap} onFocusViolation={onFocusViolation} />}

    <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3">
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => <div key={i} className="glass-card rounded-lg p-4 loading-skeleton h-20" />)
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-gold/60">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <p>No users found nearby</p>
          <p className="text-sm">Try increasing the search radius</p>
        </div>
      ) : (
        users.map((user) => (
          <Card key={user._id} padding="small" className="cursor-pointer hover:shadow-gold-glow transition-all" onClick={() => onSelectUser(user)}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-gold to-gold-light rounded-full flex items-center justify-center text-jet font-bold">{user.name.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <p className="text-gold font-medium truncate">{user.name}</p>
                    {user.isOnline && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                  </div>
                  {user.distance && <p className="text-gold/40 text-xs">{user.distance} km</p>}
                </div>
                <p className="text-gold/60 text-sm truncate">{user.email}</p>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  </div>
);

export default DashboardSidebar;
