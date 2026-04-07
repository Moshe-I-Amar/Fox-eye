import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/usersApi';
import { hierarchyService } from '../services/hierarchyApi';
import socketService from '../services/socketService';
import { isValidCoords, safeGetCoords } from '../utils/location';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import Navbar from '../components/layout/Navbar';
import AlertBanner from '../components/ui/AlertBanner';
import useSocketConnection from '../hooks/useSocketConnection';
import BreachAlertPanel from './admin/BreachAlertPanel';
import AdminUserDetailModal from './admin/AdminUserDetailModal';
import { formatTimestamp } from '../utils/formatUtils';

const Admin = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [breachAlerts, setBreachAlerts] = useState([]);
  const [hierarchyMap, setHierarchyMap] = useState({ units: {}, companies: {}, teams: {}, squads: {} });
  const breachTimersRef = useRef(new Map());
  const navigate = useNavigate();

  const onConnect = () => socketService.subscribeToPresence();
  const { realtimeEnabled, realtimeStatus, realtimeNotice, realtimeNoticeTone, clearRealtimeNotice } = useSocketConnection({ navigate, onConnect });

  useEffect(() => {
    let active = true;
    hierarchyService.getTree().then((data) => {
      if (!active) return;
      const units = {}, companies = {}, teams = {}, squads = {};
      (data.units || []).forEach((u) => { units[u._id] = u.name; });
      (data.companies || []).forEach((c) => { companies[c._id] = c.name; });
      (data.teams || []).forEach((t) => { teams[t._id] = t.name; });
      (data.squads || []).forEach((s) => { squads[s._id] = s.name; });
      setHierarchyMap({ units, companies, teams, squads });
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => { return () => { breachTimersRef.current.forEach(clearTimeout); breachTimersRef.current.clear(); }; }, []);

  useEffect(() => {
    if (!realtimeEnabled) return;
    const handleLocation = (data) => {
      const ts = data.timestamp || new Date().toISOString();
      setUsers((prev) => prev.map((u) => u._id === data.userId ? { ...u, location: data.location, lastSeen: ts, lastUpdateAt: ts } : u));
      setSelectedUser((prev) => prev?._id === data.userId ? { ...prev, location: data.location, lastSeen: ts, lastUpdateAt: ts } : prev);
    };
    const handleUserJoined = (d) => setOnlineUsers((prev) => new Set([...prev, d.userId]));
    const handleUserLeft = (d) => setOnlineUsers((prev) => { const next = new Set(prev); next.delete(d.userId); return next; });
    const handlePresence = (d) => {
      setUsers((prev) => prev.map((u) => u._id === d.userId ? { ...u, online: d.online, lastSeen: d.lastSeen, lastUpdateAt: d.lastSeen } : u));
      setOnlineUsers((prev) => { const next = new Set(prev); d.online ? next.add(d.userId) : next.delete(d.userId); return next; });
      setSelectedUser((prev) => prev?._id === d.userId ? { ...prev, online: d.online, lastSeen: d.lastSeen, lastUpdateAt: d.lastSeen } : prev);
    };
    const handleBreach = (data) => {
      if (!data?.userId) return;
      const alertId = `${data.userId}-${data.timestamp || Date.now()}`;
      setBreachAlerts((prev) => [{ id: alertId, userId: data.userId, name: data.name || 'Unknown', timestamp: data.timestamp || new Date().toISOString(), breachSince: data.breachSince || data.timestamp || new Date().toISOString(), aoName: data.ao?.name || 'Unassigned', cooldownMs: data.cooldownMs, graceMs: data.graceMs, toleranceMeters: data.toleranceMeters }, ...prev].slice(0, 5));
      clearTimeout(breachTimersRef.current.get(alertId));
      breachTimersRef.current.set(alertId, setTimeout(() => { setBreachAlerts((prev) => prev.filter((a) => a.id !== alertId)); breachTimersRef.current.delete(alertId); }, 8000));
    };
    socketService.on('admin:location:updated', handleLocation); socketService.on('presence:user_joined', handleUserJoined);
    socketService.on('presence:user_left', handleUserLeft); socketService.on('presence:update', handlePresence); socketService.on('ao:breach', handleBreach);
    return () => {
      socketService.off('admin:location:updated', handleLocation); socketService.off('presence:user_joined', handleUserJoined);
      socketService.off('presence:user_left', handleUserLeft); socketService.off('presence:update', handlePresence); socketService.off('ao:breach', handleBreach);
    };
  }, [realtimeEnabled]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await userService.getAllUsers(pagination.page, pagination.limit);
        setUsers(res.users.map((u) => ({ ...u, lastUpdateAt: u.lastUpdateAt || u.lastSeen || u.updatedAt })));
        setPagination((prev) => ({ ...prev, ...res.pagination }));
      } catch {} finally { setLoading(false); }
    })();
  }, [pagination.page, pagination.limit]);

  const filteredUsers = users.filter((u) => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen">
      <Navbar realtimeStatus={realtimeStatus} />
      {realtimeNotice && <div className="px-6 pt-4"><AlertBanner message={realtimeNotice} tone={realtimeNoticeTone === 'error' ? 'error' : 'warning'} onDismiss={clearRealtimeNotice} /></div>}
      <BreachAlertPanel breachAlerts={breachAlerts} />
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div><h1 className="text-3xl font-bold text-gold mb-2">Admin Dashboard</h1><p className="text-gold/60">Manage all users in the system</p></div>
              {realtimeEnabled && <div className="flex items-center space-x-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /><span className="text-green-400 text-sm">Real-time monitoring</span></div>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card glass className="md:col-span-2"><Input placeholder="Search users by name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent" /></Card>
            <Card glass><div className="text-center"><p className="text-gold/60 text-sm">Total Users</p><p className="text-3xl font-bold text-gold">{pagination.total}</p><p className="text-xs text-green-400 mt-2">{onlineUsers.size} online</p></div></Card>
          </div>
          <Card glass>
            <Table loading={loading} data={filteredUsers} pageSize={0} emptyMessage={searchTerm ? 'No users match your search' : 'No users found'} columns={[
              { key: 'name', label: 'User', sortable: true, render: (_, u) => <div className="flex items-center space-x-3"><div className="relative"><div className="w-8 h-8 bg-gradient-to-r from-gold to-gold-light rounded-full flex items-center justify-center text-jet text-sm font-bold">{u.name.charAt(0).toUpperCase()}</div>{onlineUsers.has(u._id) && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-jet" title="Online" />}</div><span className="text-gold">{u.name}</span></div> },
              { key: 'email', label: 'Email', sortable: true, render: (v) => <span className="text-gold/80">{v}</span> },
              { key: 'role', label: 'Role', render: (v) => <Badge variant={v === 'admin' ? 'gold' : 'gray'}>{v}</Badge> },
              { key: 'createdAt', label: 'Joined', sortable: true, render: (v, u) => <div className="flex flex-col"><span className="text-gold/60">{new Date(v).toLocaleDateString()}</span>{u.lastSeen && <span className="text-xs text-gold/40">Last seen: {new Date(u.lastSeen).toLocaleTimeString()}</span>}</div> },
              { key: 'location', label: 'Location', render: (_, u) => { const c = safeGetCoords(u); const ok = isValidCoords(c) && !(c[0] === 0 && c[1] === 0); return ok ? <span className="text-xs text-gold/60">{c[1].toFixed(2)}, {c[0].toFixed(2)}</span> : <span className="text-gold/40 italic">No location yet</span>; } },
              { key: '_id', label: 'Actions', render: (_, u) => <Button variant="outline" size="sm" onClick={() => setSelectedUser(u)}>View</Button> },
            ]} />
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gold/20">
                <div className="text-gold/60 text-sm">Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} disabled={pagination.page === 1}>Previous</Button>
                  <span className="text-gold text-sm">{pagination.page} / {pagination.pages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} disabled={pagination.page === pagination.pages}>Next</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
      <AdminUserDetailModal user={selectedUser} hierarchyMap={hierarchyMap} onClose={() => setSelectedUser(null)} />
    </div>
  );
};

export default Admin;
