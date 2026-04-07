import { useState, useEffect, useRef } from 'react';
import socketService from '../../services/socketService';
import { isValidCoords } from '../../utils/location';
import { EVENT_TYPE_CONFIG } from '../../utils/markerUtils';
import { calculateDistance } from '../../utils/mapGeometry';

const useDashboardSocket = ({ realtimeEnabled, mapCenter, userLocation, currentUserId, setUsers, setSelectedUser, setAos, setEventAlert }) => {
  const [liveUpdateIds, setLiveUpdateIds] = useState(new Set());
  const [onlineUsers,   setOnlineUsers]   = useState(new Set());
  const liveUpdateTimers = useRef(new Map());

  const markLiveUpdate = (userId) => {
    setLiveUpdateIds((prev) => new Set([...prev, userId]));
    clearTimeout(liveUpdateTimers.current.get(userId));
    liveUpdateTimers.current.set(userId, setTimeout(() => {
      setLiveUpdateIds((prev) => { const next = new Set(prev); next.delete(userId); return next; });
      liveUpdateTimers.current.delete(userId);
    }, 1600));
  };

  useEffect(() => {
    return () => { liveUpdateTimers.current.forEach(clearTimeout); liveUpdateTimers.current.clear(); };
  }, []);

  useEffect(() => {
    if (!realtimeEnabled) return;

    const handleLocation = (data) => {
      if (!isValidCoords(data?.coordinates)) return;
      const [lng, lat] = data.coordinates;
      const distCenter = isValidCoords(userLocation) ? userLocation : mapCenter;
      const loc = { type: 'Point', coordinates: [lng, lat] };
      const ts = data.timestamp || new Date().toISOString();
      setUsers((prev) => { const i = prev.findIndex((u) => u._id === data.userId); if (i === -1) return prev; const next = [...prev]; next[i] = { ...next[i], location: loc, distance: calculateDistance(distCenter, [lat, lng]), lastUpdateAt: ts }; return next; });
      setSelectedUser((prev) => prev?._id === data.userId ? { ...prev, location: loc, distance: calculateDistance(distCenter, [lat, lng]), lastUpdateAt: ts } : prev);
      markLiveUpdate(data.userId);
      setOnlineUsers((prev) => new Set([...prev, data.userId]));
    };

    const handlePresence = (data) => {
      if (data.online) {
        setUsers((prev) => prev.map((u) => u._id === data.userId ? { ...u, isOnline: true, lastSeen: data.lastSeen } : u));
        setSelectedUser((prev) => prev?._id === data.userId ? { ...prev, isOnline: true, lastSeen: data.lastSeen } : prev);
      } else {
        // User went offline — remove from map and sidebar immediately
        setUsers((prev) => prev.filter((u) => u._id !== data.userId));
        setSelectedUser((prev) => prev?._id === data.userId ? null : prev);
      }
      setOnlineUsers((prev) => { const next = new Set(prev); data.online ? next.add(data.userId) : next.delete(data.userId); return next; });
    };

    const handleEventNew = ({ event } = {}) => {
      if (!event || event.status !== 'ACTIVE') return;
      const cfg = EVENT_TYPE_CONFIG[event.eventType]; if (!cfg) return;
      setEventAlert({ id: event._id, message: `${cfg.glyph} ${cfg.label.toUpperCase()} — reported by ${event.senderName || 'Unknown'}`, tone: cfg.alertTone, autoDismiss: cfg.autoDismiss });
    };

    const handleLocationResponse = (data) => {
      setUsers(data.users.map((u) => ({ ...u, isOnline: onlineUsers.has(u._id) || u.online === true, lastUpdateAt: u.lastUpdateAt || u.lastSeen || u.updatedAt })));
    };

    const upsertAo = (incoming) => { if (!incoming?._id) return; setAos((prev) => { const i = prev.findIndex((ao) => ao._id === incoming._id); return i === -1 ? [incoming, ...prev] : prev.map((ao, idx) => idx === i ? incoming : ao); }); };
    const handleAoCreated = (d) => { if (d?.ao) upsertAo(d.ao); };
    const handleAoUpdated = (d) => { if (d?.ao) upsertAo(d.ao); };
    const handleAoDeleted = (d) => { const id = d?.aoId || d?.ao?._id; if (id) setAos((prev) => prev.filter((ao) => ao._id !== id)); };

    socketService.on('location:update', handleLocation); socketService.on('presence:update', handlePresence);
    socketService.on('field:event:new', handleEventNew); socketService.on('location:response', handleLocationResponse);
    socketService.on('ao:created', handleAoCreated); socketService.on('ao:updated', handleAoUpdated); socketService.on('ao:deleted', handleAoDeleted);
    return () => {
      socketService.off('location:update', handleLocation); socketService.off('presence:update', handlePresence);
      socketService.off('field:event:new', handleEventNew); socketService.off('location:response', handleLocationResponse);
      socketService.off('ao:created', handleAoCreated); socketService.off('ao:updated', handleAoUpdated); socketService.off('ao:deleted', handleAoDeleted);
    };
  }, [realtimeEnabled, mapCenter, currentUserId, userLocation, onlineUsers]); // eslint-disable-line react-hooks/exhaustive-deps

  return { liveUpdateIds, onlineUsers };
};

export default useDashboardSocket;
