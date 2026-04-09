import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socketService';
import { userService } from '../services/usersApi';
import { eventApi } from '../services/eventApi';
import { isValidCoords } from '../utils/location';
import { normalizeCoords } from '../utils/mapGeometry';
import Navbar from '../components/layout/Navbar';
import AlertBanner from '../components/ui/AlertBanner';
import Card from '../components/ui/Card';
import NotificationPrompt from '../components/ui/NotificationPrompt';
import useAOs from '../hooks/useAOs';
import useViolations from '../hooks/useViolations';
import useFieldEvents from '../hooks/useFieldEvents';
import useSocketConnection from '../hooks/useSocketConnection';
import DashboardMap from './dashboard/DashboardMap';
import DashboardSidebar from './dashboard/DashboardSidebar';
import AOModal from './dashboard/AOModal';
import UserDetailModal from './dashboard/UserDetailModal';
import useAOHandlers from './dashboard/useAOHandlers';
import useHierarchyData from './dashboard/useHierarchyData';
import useLocationTracking from './dashboard/useLocationTracking';
import useDashboardSocket from './dashboard/useDashboardSocket';
import { DEFAULT_MAP_CENTER, DEFAULT_SEARCH_RADIUS_KM } from '../config/constants';

const Dashboard = () => {
  const [sidebarOpen,        setSidebarOpen]        = useState(false);
  const [users,              setUsers]              = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [selectedUser,       setSelectedUser]       = useState(null);
  const [mapCenter,          setMapCenter]          = useState(DEFAULT_MAP_CENTER);
  const [radius,             setRadius]             = useState(DEFAULT_SEARCH_RADIUS_KM);
  const [viewportBounds,     setViewportBounds]     = useState(null);
  const [showResolvedEvents, setShowResolvedEvents] = useState(false);
  const [eventAlert,         setEventAlert]         = useState(null);
  const [respondingIds,      setRespondingIds]      = useState(new Set());
  const [violationFilters,   setViolationFilters]   = useState({ severity: 'all', companyId: '', start: '', end: '' });
  const nearbyFetchTimerRef  = useRef(null);
  const realtimeEnabledRef   = useRef(false);
  const socketInitializedRef = useRef(false);
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id || currentUser?._id;

  const { aos, setAos, loading: aoLoading, error: aoError, setError: setAoError, refetch: fetchAOs } = useAOs();
  const canManageAOs = currentUser?.role === 'admin' || currentUser?.operationalRole === 'COMPANY_COMMANDER';
  const canViewViolations = currentUser?.role === 'admin' || ['HQ', 'UNIT_COMMANDER'].includes(currentUser?.operationalRole);
  const { violations, loading: violationLoading, error: violationError } = useViolations(canViewViolations, violationFilters);
  const { events: fieldEvents, loading: fieldEventsLoading } = useFieldEvents(50);
  const { hierarchyMap, companyOptions } = useHierarchyData();
  const aoHandlers = useAOHandlers({ setAos, fetchAOs, setAoError, companyOptions, currentUser });

  const onConnect = useCallback(() => { socketService.subscribeToPresence(); socketInitializedRef.current = true; }, []);
  const { realtimeEnabled, realtimeStatus, realtimeNotice, realtimeNoticeTone, clearRealtimeNotice } = useSocketConnection({ navigate, onConnect });
  useEffect(() => { realtimeEnabledRef.current = realtimeEnabled; }, [realtimeEnabled]);
  useEffect(() => { fetchAOs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!eventAlert?.autoDismiss) return; const t = setTimeout(() => setEventAlert(null), 8000); return () => clearTimeout(t); }, [eventAlert]);
  useEffect(() => { return () => clearTimeout(nearbyFetchTimerRef.current); }, []);

  const { userLocation, locationLoading, locationError } = useLocationTracking({ realtimeEnabledRef, socketInitializedRef, onFirstLocation: setMapCenter });
  const { liveUpdateIds } = useDashboardSocket({ realtimeEnabled, mapCenter, userLocation, currentUserId, setUsers, setSelectedUser, setAos, setEventAlert });

  useEffect(() => {
    if (!realtimeEnabled || !viewportBounds || !socketService.isSocketConnected()) return;
    socketService.subscribeToViewport(viewportBounds);
  }, [realtimeEnabled, viewportBounds]);

  const fetchNearbyUsers = useCallback(async (center) => {
    if (!center) { setLoading(false); return; }
    try {
      setLoading(true);
      if (realtimeEnabled && socketService.isSocketConnected()) socketService.requestLocation(center, radius, true);
      else if (socketInitializedRef.current) { const res = await userService.getUsersNearby(center[0], center[1], radius); setUsers(res.users.map((u) => ({ ...u, isOnline: u.online === true, lastUpdateAt: u.lastUpdateAt || u.lastSeen || u.updatedAt }))); }
    } catch {} finally { setLoading(false); }
  }, [radius, realtimeEnabled]);

  useEffect(() => {
    const center = isValidCoords(userLocation) ? userLocation : viewportBounds ? [(viewportBounds.minLat + viewportBounds.maxLat) / 2, (viewportBounds.minLng + viewportBounds.maxLng) / 2] : mapCenter;
    if (!center) return;
    clearTimeout(nearbyFetchTimerRef.current);
    nearbyFetchTimerRef.current = setTimeout(() => fetchNearbyUsers(center), 450);
  }, [fetchNearbyUsers, userLocation, viewportBounds, mapCenter, radius, realtimeEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const getCompanyIdentity = useCallback((ao) => {
    const company = hierarchyMap.companies[ao?.companyId];
    const companyColor = company?.color || '#C7A76C';
    const companyIcon = company?.icon || '';
    const companyPattern = company?.pattern || null;
    return {
      color: ao?.style?.color || companyColor,
      icon: ao?.style?.icon || companyIcon,
      pattern: ao?.style?.pattern || companyPattern,
    };
  }, [hierarchyMap.companies]);

  const { visibleEvents, activeEventCount } = useMemo(() => {
    let active = 0; const visible = [];
    for (const ev of fieldEvents) {
      if (ev.status === 'ACTIVE') active++;
      const c = ev.coordinates?.coordinates;
      if (!Array.isArray(c) || c.length !== 2) continue;
      if (!showResolvedEvents && ev.status === 'RESOLVED') continue;
      visible.push(ev);
    }
    return { visibleEvents: visible, activeEventCount: active };
  }, [fieldEvents, showResolvedEvents]);

  const handleEventRespond = useCallback(async (id, action) => {
    setRespondingIds((prev) => new Set([...prev, id]));
    try {
      await (action === 'acknowledge' ? eventApi.acknowledgeEvent(id) : eventApi.resolveEvent(id));
      setEventAlert((prev) => (prev?.id === id ? null : prev));
    } catch {} finally { setRespondingIds((prev) => { const next = new Set(prev); next.delete(id); return next; }); }
  }, []);

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Navbar realtimeStatus={realtimeStatus} />
      {realtimeNotice && <div className="px-6 pt-4 shrink-0"><AlertBanner message={realtimeNotice} tone={realtimeNoticeTone === 'error' ? 'error' : 'warning'} onDismiss={clearRealtimeNotice} /></div>}
      {eventAlert && <div className="px-6 pt-3 shrink-0"><AlertBanner message={eventAlert.message} tone={eventAlert.tone} onDismiss={() => setEventAlert(null)} action={eventAlert.id ? { label: 'ACK', onClick: () => handleEventRespond(eventAlert.id, 'acknowledge'), disabled: respondingIds.has(eventAlert.id) } : undefined} /></div>}
      <div className="px-6 pt-3 shrink-0"><NotificationPrompt /></div>
      <div className="lg:hidden shrink-0 flex items-center gap-2 px-4 pt-3">
        <button onClick={() => setSidebarOpen((o) => !o)} className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-gold text-sm min-h-[44px] min-w-[44px]" aria-label="Toggle sidebar">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          <span>{sidebarOpen ? 'Hide Panel' : 'Show Panel'}</span>
        </button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <DashboardSidebar isOpen={sidebarOpen} realtimeEnabled={realtimeEnabled} users={users} loading={loading} radius={radius} locationLoading={locationLoading} locationError={locationError} onRadiusChange={setRadius} onSelectUser={setSelectedUser}
          aos={aos} aoLoading={aoLoading} aoError={aoError} canManageAOs={canManageAOs} getCompanyIdentity={getCompanyIdentity} onSelectAO={aoHandlers.handleAOSelect} onToggleAOActive={aoHandlers.handleToggleAOActive} onDeleteAO={aoHandlers.handleAODirectDelete}
          visibleEvents={visibleEvents} activeEventCount={activeEventCount} fieldEventsLoading={fieldEventsLoading} showResolvedEvents={showResolvedEvents} onToggleResolved={setShowResolvedEvents} respondingIds={respondingIds} onRespond={handleEventRespond} onFocusEvent={(ev) => { const c = normalizeCoords(ev?.coordinates?.coordinates); if (c) setMapCenter(c); }}
          canViewViolations={canViewViolations} violations={violations} violationLoading={violationLoading} violationError={violationError} violationFilters={violationFilters} onViolationFilterChange={setViolationFilters} companyOptions={companyOptions} hierarchyMap={hierarchyMap} onFocusViolation={(v) => { const c = normalizeCoords(v?.coordinates); if (c) setMapCenter(c); }}
        />
        <div className="flex-1 min-h-0 p-4 lg:p-6">
          <Card className="h-full p-0">
            <DashboardMap center={mapCenter} users={users} userLocation={userLocation} onUserClick={setSelectedUser} liveUpdateIds={liveUpdateIds} onViewportChange={useCallback((vp) => setViewportBounds(vp), [])} aos={aos} onAOCreate={aoHandlers.handleAOCreate} onAOEdit={aoHandlers.handleAOEdit} onAODelete={aoHandlers.handleAODelete} onAOSelect={aoHandlers.handleAOSelect} featureGroupRef={aoHandlers.featureGroupRef} canManageAOs={canManageAOs} getCompanyIdentity={getCompanyIdentity} fieldEvents={visibleEvents} onEventClick={(ev) => { const c = normalizeCoords(ev?.coordinates?.coordinates); if (c) setMapCenter(c); }} onEventRespond={handleEventRespond} respondingIds={respondingIds} />
          </Card>
        </div>
      </div>
      <AOModal isOpen={aoHandlers.isAoModalOpen} mode={aoHandlers.aoModalMode} aoForm={aoHandlers.aoForm} aoNameError={aoHandlers.aoNameError} aoIconError={aoHandlers.aoIconError} aoSaving={aoHandlers.aoSaving} visibleCompanies={aoHandlers.visibleCompanies} currentUserRole={currentUser?.role} onClose={aoHandlers.handleAOCancel} onChange={(patch) => aoHandlers.setAoForm((prev) => ({ ...prev, ...patch }))} onSubmit={aoHandlers.handleAOSubmit} />
      <UserDetailModal user={selectedUser} hierarchyMap={hierarchyMap} onClose={() => setSelectedUser(null)} />
    </div>
  );
};

export default Dashboard;
