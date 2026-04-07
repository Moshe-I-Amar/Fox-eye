import React from 'react';
import Modal from '../../components/ui/Modal';
import Card from '../../components/ui/Card';
import { isValidCoords, safeGetCoords } from '../../utils/location';
import { formatTimestamp } from '../../utils/formatUtils';

const AdminUserDetailModal = ({ user, hierarchyMap, onClose }) => (
  <Modal isOpen={!!user} onClose={onClose} title="User Details" size="medium">
    {user && (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 bg-gradient-to-r from-gold to-gold-light rounded-full flex items-center justify-center text-jet text-2xl font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gold">{user.name}</h3>
            <p className="text-gold/60">{user.email}</p>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${user.role === 'admin' ? 'bg-gold/20 text-gold' : 'bg-slate-medium/20 text-slate-medium'}`}>{user.role}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card glass padding="small"><p className="text-gold/60 text-sm mb-1">User ID</p><p className="text-gold font-mono text-xs">{user._id}</p></Card>
          <Card glass padding="small"><p className="text-gold/60 text-sm mb-1">Joined</p><p className="text-gold">{new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p></Card>
        </div>

        <Card glass>
          <p className="text-gold/60 text-sm mb-3">Location</p>
          {(() => {
            const coords = safeGetCoords(user);
            const hasCoords = isValidCoords(coords) && !(coords[0] === 0 && coords[1] === 0);
            if (!hasCoords) return <p className="text-gold/40 italic">No location yet</p>;
            return (
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-gold/60">Latitude:</span><span className="text-gold font-mono">{coords[1].toFixed(6)}</span></div>
                <div className="flex justify-between"><span className="text-gold/60">Longitude:</span><span className="text-gold font-mono">{coords[0].toFixed(6)}</span></div>
              </div>
            );
          })()}
        </Card>

        <Card glass><p className="text-gold/60 text-sm mb-3">Last Update</p><p className="text-gold">{formatTimestamp(user.lastUpdateAt || user.lastSeen || user.updatedAt)}</p></Card>

        <Card glass>
          <p className="text-gold/60 text-sm mb-3">Hierarchy</p>
          <div className="space-y-2 text-sm text-gold">
            {[['Unit', 'unitId', hierarchyMap.units], ['Company', 'companyId', hierarchyMap.companies], ['Team', 'teamId', hierarchyMap.teams], ['Squad', 'squadId', hierarchyMap.squads]].map(([label, key, map]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gold/60">{label}:</span>
                <span>{map[user[key]] || user[key] || 'Unassigned'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    )}
  </Modal>
);

export default AdminUserDetailModal;
