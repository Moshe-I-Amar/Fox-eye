import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authApi';
import { userService } from '../services/usersApi';
import socketService from '../services/socketService';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
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

    const handleAuthError = () => {
      setRealtimeStatus('offline');
      setRealtimeEnabled(false);
      setRealtimeNoticeTone('error');
      setRealtimeNotice('Session expired. Redirecting to login...');
      authService.logout();
      navigate('/login', {
        replace: true,
        state: {
          reason: 'session-expired',
          message: 'Your session expired. Please sign in again.'
        }
      });
    };

    socketService.on('connect', handleConnect);
    socketService.on('disconnected', handleDisconnect);
    socketService.on('reconnecting', handleReconnect);
    socketService.on('connect_error', handleConnectError);
    socketService.on('reconnect_failed', handleReconnectFailed);
    socketService.on('auth_error', handleAuthError);

    const initSocket = async () => {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (token && user.role === 'admin') {
        try {
          await socketService.connect(token);
          setRealtimeEnabled(true);
          setRealtimeStatus('connected');
          
          // Subscribe to presence updates
          socketService.subscribeToPresence();
          
          console.log('Admin socket connected and authenticated');
        } catch (error) {
          const message = `${error?.message || ''}`.toLowerCase();
          if (message.includes('authentication error') || message.includes('token expired') || message.includes('invalid token')) {
            return;
          }
          console.error('Failed to connect admin socket:', error);
          setRealtimeEnabled(false);
          setRealtimeStatus('offline');
        }
      }
    };

    initSocket();

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnected', handleDisconnect);
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
      console.log('Admin received location update:', data);
      
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

    socketService.on('admin:location:updated', handleAdminLocationUpdate);
    socketService.on('presence:user_joined', handleUserJoined);
    socketService.on('presence:user_left', handleUserLeft);
    socketService.on('presence:update', handlePresenceUpdate);

    return () => {
      socketService.off('admin:location:updated', handleAdminLocationUpdate);
      socketService.off('presence:user_joined', handleUserJoined);
      socketService.off('presence:user_left', handleUserLeft);
      socketService.off('presence:update', handlePresenceUpdate);
    };
  }, [realtimeEnabled]);

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, pagination.limit]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getAllUsers(pagination.page, pagination.limit);
      setUsers(response.data.users.map(user => ({
        ...user,
        lastUpdateAt: user.lastUpdateAt || user.lastSeen || user.updatedAt
      })));
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
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
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              realtimeNoticeTone === 'error'
                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : 'border-gold/30 bg-gold/10 text-gold/80'
            }`}
          >
            {realtimeNotice}
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
            <div className="overflow-x-auto">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="glass-card rounded-lg p-4 loading-skeleton h-16" />
                  ))}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gold/20">
                      <th className="text-left py-3 px-4 text-gold font-medium">User</th>
                      <th className="text-left py-3 px-4 text-gold font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-gold font-medium">Role</th>
                      <th className="text-left py-3 px-4 text-gold font-medium">Joined</th>
                      <th className="text-left py-3 px-4 text-gold font-medium">Location</th>
                      <th className="text-left py-3 px-4 text-gold font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-8 text-gold/60">
                          {searchTerm ? 'No users found matching your search' : 'No users found'}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user._id} className="border-b border-gold/10 hover:bg-gold/5 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-r from-gold to-gold-light rounded-full flex items-center justify-center text-jet text-sm font-bold">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-gold">{user.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gold/80">{user.email}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.role === 'admin' 
                                ? 'bg-gold/20 text-gold' 
                                : 'bg-slate-medium/20 text-slate-medium'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gold/60">
                            <div className="flex flex-col space-y-1">
                              <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                              {user.lastSeen && (
                                <span className="text-xs text-gold/40">
                                  Last seen: {new Date(user.lastSeen).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {onlineUsers.has(user._id) && (
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              )}
                              {user.location.coordinates[0] !== 0 || user.location.coordinates[1] !== 0 ? (
                                <span className="text-xs text-gold/60">
                                  {user.location.coordinates[1].toFixed(2)}, {user.location.coordinates[0].toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gold/40">Not set</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="outline"
                              size="small"
                              onClick={() => handleUserClick(user)}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gold/20">
                <div className="text-gold/60 text-sm">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} users
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="small"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  
                  <span className="flex items-center px-3 text-gold">
                    {pagination.page} / {pagination.pages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="small"
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
              {selectedUser.location.coordinates[0] !== 0 || selectedUser.location.coordinates[1] !== 0 ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gold/60">Latitude:</span>
                    <span className="text-gold font-mono">{selectedUser.location.coordinates[1].toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gold/60">Longitude:</span>
                    <span className="text-gold font-mono">{selectedUser.location.coordinates[0].toFixed(6)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-gold/40 italic">Location not set</p>
              )}
            </Card>

            <Card glass>
              <p className="text-gold/60 text-sm mb-3">Last Update</p>
              <p className="text-gold">
                {formatTimestamp(selectedUser.lastUpdateAt || selectedUser.lastSeen || selectedUser.updatedAt)}
              </p>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Admin;
