import React from 'react';
import Card from '../../components/ui/Card';
import { isImageUrl } from '../../utils/markerUtils';
import { DEFAULT_AO_COLOR } from '../../config/constants';

const AOPanel = ({ aos, aoLoading, aoError, canManageAOs, getCompanyIdentity, onSelectAO, onToggleAOActive }) => {
  const renderIcon = (ao) => {
    const { color, icon } = getCompanyIdentity(ao);
    const trimmedIcon = `${icon || ''}`.trim();
    const hasImage = trimmedIcon && isImageUrl(trimmedIcon);
    return (
      <span className="h-6 w-6 rounded-full border border-white/10 flex items-center justify-center text-[10px] text-white" style={{ backgroundColor: color }}>
        {hasImage ? <img src={trimmedIcon} alt="" className="h-3.5 w-3.5" /> : trimmedIcon}
      </span>
    );
  };

  return (
    <Card className="mb-6" padding="small">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gold">Area Overlays</h3>
          <span className="text-xs text-gold/60">{aos.length} saved</span>
        </div>
        <p className="text-xs text-gold/60">
          {canManageAOs
            ? 'Use the polygon tool on the map to draw a new AO. Use the edit tool to reshape saved polygons.'
            : 'Viewing active overlays. Contact a commander to add or edit coverage.'}
        </p>
        {aoError && <p className="text-xs text-red-400">{aoError}</p>}
        <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
          {aoLoading ? (
            <div className="text-xs text-gold/50">Loading overlays...</div>
          ) : aos.length === 0 ? (
            <div className="flex flex-col items-center py-4 text-gold/40 gap-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              <p className="text-xs">No AOs defined yet</p>
              {canManageAOs && <p className="text-[10px] text-gold/30">Draw one on the map above</p>}
            </div>
          ) : (
            aos.map((ao) => (
              <div key={ao._id} className="flex items-center justify-between rounded-lg border border-gold/10 px-3 py-2" style={{ borderColor: ao.style?.color || DEFAULT_AO_COLOR }}>
                <div className="flex items-center space-x-2 min-w-0">
                  {renderIcon(ao)}
                  <div className="min-w-0">
                    <p className="text-sm text-gold truncate">{ao.name}</p>
                    <p className="text-[11px] text-gold/50">{ao.active ? 'Active' : 'Inactive'}</p>
                  </div>
                </div>
                {canManageAOs && (
                  <div className="flex items-center space-x-2">
                    <button className="text-xs text-gold/70 hover:text-gold" onClick={() => onSelectAO(ao)}>Edit</button>
                    <button className="text-xs text-gold/70 hover:text-gold" onClick={() => onToggleAOActive(ao)}>{ao.active ? 'Disable' : 'Enable'}</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
};

export default AOPanel;
