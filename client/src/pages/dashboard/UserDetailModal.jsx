import React from 'react';
import Modal from '../../components/ui/Modal';
import { isValidCoords, safeGetCoords } from '../../utils/location';
import { formatTimestamp } from '../../utils/formatUtils';

const UserDetailModal = ({ user, hierarchyMap, onClose }) => (
  <Modal isOpen={!!user} onClose={onClose} title="User Details" size="small">
    {user && (
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gradient-to-r from-gold to-gold-light rounded-full flex items-center justify-center text-jet text-2xl font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gold">{user.name}</h3>
            <p className="text-gold/60">{user.email}</p>
            <p className="text-gold/40 text-sm">Role: {user.role}</p>
          </div>
        </div>

        {user.distance && (
          <div className="glass-card rounded-lg p-3">
            <p className="text-gold text-sm"><span className="text-gold/60">Distance:</span> {user.distance} km</p>
          </div>
        )}

        <div className="glass-card rounded-lg p-3">
          <p className="text-gold/60 text-sm mb-2">Location</p>
          {(() => {
            const coords = safeGetCoords(user);
            if (!isValidCoords(coords)) return <p className="text-gold/40 italic">No location yet</p>;
            return <><p className="text-gold text-sm">Lat: {coords[1].toFixed(6)}</p><p className="text-gold text-sm">Lng: {coords[0].toFixed(6)}</p></>;
          })()}
        </div>

        <div className="glass-card rounded-lg p-3">
          <p className="text-gold/60 text-sm mb-2">Last Update</p>
          <p className="text-gold text-sm">{formatTimestamp(user.lastUpdateAt || user.lastSeen || user.updatedAt)}</p>
        </div>

        <div className="glass-card rounded-lg p-3">
          <p className="text-gold/60 text-sm mb-2">Hierarchy</p>
          <div className="space-y-2 text-sm text-gold">
            {[['Unit', 'unitId', hierarchyMap.units], ['Company', 'companyId', hierarchyMap.companies], ['Team', 'teamId', hierarchyMap.teams], ['Squad', 'squadId', hierarchyMap.squads]].map(([label, key, map]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gold/60">{label}:</span>
                <span>{(typeof map[user[key]] === 'object' ? map[user[key]]?.name : map[user[key]]) || user[key] || 'Unassigned'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
  </Modal>
);

export default UserDetailModal;
