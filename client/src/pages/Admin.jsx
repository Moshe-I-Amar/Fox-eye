import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authApi';
import { userService } from '../services/usersApi';
import { hierarchyService } from '../services/hierarchyApi';
import socketService from '../services/socketService';
import { isValidCoords, safeGetCoords } from '../utils/location';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import AlertBanner from '../components/ui/AlertBanner';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import Navbar from '../components/layout/Navbar';

const Admin = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('offline');
  const [realtimeNotice, setRealtimeNotice] = useState('');
  const [realtimeNoticeTone, setRealtimeNoticeTone] = useState('warning');
  const [breachAlerts, setBreachAlerts] = useState([]);
  const [hierarchyMap, setHierarchyMap] = useState({
    units: {},
    companies: {},
    teams: {},
    squads: {}
  });
  const breachTimersRef = useRef(new Map());
  const navigate = useNavigate();

  // Initialize socket for admin features
  useEffect(() => {
    const handleConnect = () => {
      setRealtimeEnabled(true);
      setRealtimeStatus('connected');
      setRealtimeNotice('');
    };

    const handleDisconnect = (payload = {}) => {
      const reason = payload?.reason;
      if (reason === 'io client disconnect' || reason === 'auth_error') {
        setRealtimeStatus('offline');
        return;
      }
      setRealtimeStatus('reconnecting');
      setRealtimeNoticeTone('warning');
      setRealtimeNotice('Live updates disconnected. Attempting to reconnect...');
    };

    const handleReconnect = () => {
      setRealtimeStatus('reconnecting');
      setRealtimeNoticeTone('warning');
      setRealtimeNotice('Reconnecting to live updates...');
    };

    const handleConnectError = () => {
      setRealtimeStatus('reconnecting');
      setRealtimeNoticeTone('warning');
      setRealtimeNotice('Live updates disconnected. Attempting to reconnect...');
    };

    const handleReconnectFailed = () => {
      setRealtimeStatus('offline');
      setRealtimeEnabled(false);
      setRealtimeNoticeTone('warning');
      setRealtimeNotice('Live updates are unavailable. Using HTTP fallback.');
    };

    const handleAuthError = async () => {
      setRealtimeStatus('offline');
      setRealtimeEnabled(false);
      setRealtimeNoticeTone('error');
      setRealtimeNotice('Session expired. Redirecting to login...');
      await authService.logout();
      navigate('/login', {
        replace: true,
        state: {
          reason: 'session-expired',
          message: 'Your session expired. Please sign in again.'
        }
      });
    };

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('reconnecting', handleReconnect);
    socketService.on('connect_error', handleConnectError);
    socketService.on('reconnect_failed', handleReconnectFailed);
    socketService.on('auth_error', handleAuthError);

    const initSocket = async () => {
      try {
        await socketService.connect(null);
        setRealtimeEnabled(true);
        setRealtimeStatus('connected');

        // Subscribe to presence updates
        socketService.subscribeToPresence();

      } catch (error) {
        const message = `${error?.message || ''}`.toLowerCase();
        if (message.includes('authentication error') || message.includes('token expired') || message.includes('invalid token')) {
          return;
        }
        setRealtimeEnabled(false);
        setRealtimeStatus('offline');
      }
    };

    initSocket();

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('reconnecting', handleReconnect);
      socketService.off('connect_error', handleConnectError);
      socketService.off('reconnect_failed', handleReconnectFailed);
      socketService.off('auth_error', handleAuthError);
      socketService.disconnect();
    };
  }, [navigate]);

  // Listen for real-time location updates (admin receives all updates)
  useEffect(() => {
    if (!realtimeEnabled) return;

    const handleAdminLocationUpdate = (data) => {
      
      // Update user in the list if present
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user._id === data.userId 
            ? { ...user, location: data.location, lastSeen: data.timestamp, lastUpdateAt: data.timestamp }
            : user
        )
      );

      setSelectedUser(prev => (
        prev && prev._id === data.userId
          ? { ...prev, location: data.location, lastSeen: data.timestamp, lastUpdateAt: data.timestamp }
          : prev
      ));
    };

    const handleUserJoined = (data) => {
      setOnlineUsers(prev => new Set([...prev, data.userId]));
    };

    const handleUserLeft = (data) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    };

    const handlePresenceUpdate = (data) => {
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user._id === data.userId
            ? { ...user, online: data.online, lastSeen: data.lastSeen, lastUpdateAt: data.lastSeen }
            : user
        )
      );
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (data.online) {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });

      setSelectedUser(prev =>
        prev && prev._id === data.userId
          ? { ...prev, online: data.online, lastSeen: data.lastSeen, lastUpdateAt: data.lastSeen }
          : prev
      );
    };

    const handleAoBreach = (data) => {
      if (!data?.userId) {
        return;
      }

      const alertId = `${data.userId}-${data.timestamp || Date.now()}`;
      setBreachAlerts(prev => [
        {
          id: alertId,
          userId: data.userId,
          name: data.name || 'Unknown',
          timestamp: data.timestamp || new Date().toISOString(),
          breachSince: data.breachSince || data.timestamp || new Date().toISOString(),
          aoName: data.ao?.name || 'Unassigned',
          cooldownMs: data.cooldownMs,
          graceMs: data.graceMs,
          toleranceMeters: data.toleranceMeters
        },
        ...prev
      ].slice(0, 5));

      if (breachTimersRef.current.has(alertId)) {
        clearTimeout(breachTimersRef.current.get(alertId));
      }

      const timeoutId = setTimeout(() => {
        setBreachAlerts(prev => prev.filter(alert => alert.id !== alertId));
        breachTimersRef.current.delete(alertId);
      }, 8000);

      breachTimersRef.current.set(alertId, timeoutId);
    };

    socketService.on('admin:location:updated', handleAdminLocationUpdate);
    socketService.on('presence:user_joined', handleUserJoined);
    socketService.on('presence:user_left', handleUserLeft);
    socketService.on('presence:update', handlePresenceUpdate);
    socketService.on('ao:breach', handleAoBreach);

    return () => {
      socketService.off('admin:location:updated', handleAdminLocationUpdate);
      socketService.off('presence:user_joined', handleUserJoined);
      socketService.off('presence:user_left', handleUserLeft);
      socketService.off('presence:update', handlePresenceUpdate);
      socketService.off('ao:breach', handleAoBreach);
    };
  }, [realtimeEnabled]);

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    let isActive = true;
    const loadHierarchy = async () => {
      try {
        const data = await hierarchyService.getTree();
        if (!isActive) return;
        const units = {};
        const companies = {};
        const teams = {};
        const squads = {};

        (data.units || []).forEach((unit) => { units[unit._id] = unit.name; });
        (data.companies || []).forEach((company) => { companies[company._id] = company.name; });
        (data.teams || []).forEach((team) => { teams[team._id] = team.name; });
        (data.squads || []).forEach((squad) => { squads[squad._id] = squad.name; });

        setHierarchyMap({ units, companies, teams, squads });
      } catch (error) {
      }
    };

    loadHierarchy();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      breachTimersRef.current.forEach((timer) => clearTimeout(timer));
      breachTimersRef.current.clear();
    };
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getAllUsers(pagination.page, pagination.limit);
      setUsers(response.users.map(user => ({
        ...user,
        lastUpdateAt: user.lastUpdateAt || user.lastSeen || user.updatedAt
      })));
      setPagination(prev => ({
        ...prev,
        ...response.pagination
      }));
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
  };

  const formatTimestamp = (value) => {
    if (!value) return 'No live updates yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unavailable';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <Navbar realtimeStatus={realtimeStatus} />

      {realtimeNotice && (
        <div className="px-6 pt-4">
          <AlertBanner
            message={realtimeNotice}
            tone={realtimeNoticeTone === 'error' ? 'error' : 'warning'}
            onDismiss={() => setRealtimeNotice('')}
          />
        </div>
      )}

      {breachAlerts.length > 0 && (
        <div className="px-6 pt-4">
          <div className="space-y-2">
            {breachAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    AO breach: {alert.name}
                  </div>
                  <div className="text-xs text-red-200/80">
                    {formatTimestamp(alert.timestamp)}
                  </div>
                </div>
                <div className="text-xs text-red-200/70">
                  Last safe AO: {alert.aoName} · Grace {Math.round((alert.graceMs || 0) / 1000)}s ·
                  Tolerance {alert.toleranceMeters || 0}m
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gold mb-2">Admin Dashboard</h1>
                <p className="text-gold/60">Manage all users in the system</p>
              </div>
              {realtimeEnabled && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-sm">Real-time monitoring</span>
                </div>
              )}
            </div>
          </div>

          {/* Search and Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card glass className="md:col-span-2">
              <Input
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent"
              />
            </Card>
            
            <Card glass>
              <div className="text-center">
                <p className="text-gold/60 text-sm">Total Users</p>
                <p className="text-3xl font-bold text-gold">{pagination.total}</p>
                <div className="mt-2">
                  <p className="text-xs text-green-400">{onlineUsers.size} online</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Users Table */}
          <Card glass>
            <Table
              loading={loading}
              data={filteredUsers}
              pageSize={0}
              emptyMessage={searchTerm ? 'No users match your search' : 'No users found'}
              columns={[
                {
                  key: 'name',
                  label: 'User',
                  sortable: true,
                  render: (_, user) => (
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-8 h-8 bg-gradient-to-r from-gold to-gold-light rounded-full flex items-center justify-center text-jet text-sm font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        {onlineUsers.has(user._id) && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-jet" title="Online" />
                        )}
                      </div>
                      <span className="text-gold">{user.name}</span>
                    </div>
                  )
                },
                {
                  key: 'email',
                  label: 'Email',
                  sortable: true,
                  render: (v) => <span className="text-gold/80">{v}</span>
                },
                {
                  key: 'role',
                  label: 'Role',
                  render: (v) => (
                    <Badge variant={v === 'admin' ? 'gold' : 'gray'}>{v}</Badge>
                  )
                },
                {
                  key: 'createdAt',
                  label: 'Joined',
                  sortable: true,
                  render: (v, user) => (
                    <div className="flex flex-col">
                      <span className="text-gold/60">{new Date(v).toLocaleDateString()}</span>
                      {user.lastSeen && (
                        <span className="text-xs text-gold/40">
                          Last seen: {new Date(user.lastSeen).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  )
                },
                {
                  key: 'location',
                  label: 'Location',
                  render: (_, user) => {
                    const coords = safeGetCoords(user);
                    const hasCoords = isValidCoords(coords) && !(coords[0] === 0 && coords[1] === 0);
                    if (!hasCoords) return <span className="text-gold/40 italic">No location yet</span>;
                    return <span className="text-xs text-gold/60">{coords[1].toFixed(2)}, {coords[0].toFixed(2)}</span>;
                  }
                },
                {
                  key: '_id',
                  label: 'Actions',
                  render: (_, user) => (
                    <Button variant="outline" size="sm" onClick={() => handleUserClick(user)}>
                      View
                    </Button>
                  )
                }
              ]}
            />

            {/* Server-side pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gold/20">
                <div className="text-gold/60 text-sm">
                  Showing {((pagination.page - 1) * pagination.limit) + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} users
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-gold text-sm">{pagination.page} / {pagination.pages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* User Details Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="User Details"
        size="medium"
      >
        {selectedUser && (
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-gradient-to-r from-gold to-gold-light rounded-full flex items-center justify-center text-jet text-2xl font-bold">
                {selectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gold">{selectedUser.name}</h3>
                <p className="text-gold/60">{selectedUser.email}</p>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
                  selectedUser.role === 'admin' 
                    ? 'bg-gold/20 text-gold' 
                    : 'bg-slate-medium/20 text-slate-medium'
                }`}>
                  {selectedUser.role}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card glass padding="small">
                <p className="text-gold/60 text-sm mb-1">User ID</p>
                <p className="text-gold font-mono text-xs">{selectedUser._id}</p>
              </Card>
              
              <Card glass padding="small">
                <p className="text-gold/60 text-sm mb-1">Joined</p>
                <p className="text-gold">
                  {new Date(selectedUser.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </Card>
            </div>

            <Card glass>
              <p className="text-gold/60 text-sm mb-3">Location</p>
              {(() => {
                const coords = safeGetCoords(selectedUser);
                const hasCoords =
                  isValidCoords(coords) && !(coords[0] === 0 && coords[1] === 0);
                if (!hasCoords) {
                  return <p className="text-gold/40 italic">No location yet</p>;
                }
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gold/60">Latitude:</span>
                      <span className="text-gold font-mono">{coords[1].toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gold/60">Longitude:</span>
                      <span className="text-gold font-mono">{coords[0].toFixed(6)}</span>
                    </div>
                  </div>
                );
              })()}
            </Card>

            <Card glass>
              <p className="text-gold/60 text-sm mb-3">Last Update</p>
              <p className="text-gold">
                {formatTimestamp(selectedUser.lastUpdateAt || selectedUser.lastSeen || selectedUser.updatedAt)}
              </p>
            </Card>

            <Card glass>
              <p className="text-gold/60 text-sm mb-3">Hierarchy</p>
              <div className="space-y-2 text-sm text-gold">
                <div className="flex justify-between">
                  <span className="text-gold/60">Unit:</span>
                  <span>{hierarchyMap.units[selectedUser.unitId] || selectedUser.unitId || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gold/60">Company:</span>
                  <span>{hierarchyMap.companies[selectedUser.companyId] || selectedUser.companyId || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gold/60">Team:</span>
                  <span>{hierarchyMap.teams[selectedUser.teamId] || selectedUser.teamId || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gold/60">Squad:</span>
                  <span>{hierarchyMap.squads[selectedUser.squadId] || selectedUser.squadId || 'Unassigned'}</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Admin;
