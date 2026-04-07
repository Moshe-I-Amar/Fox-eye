import React from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { isImageUrl } from '../../utils/markerUtils';
import { AO_NAME_MIN, AO_NAME_MAX, AO_ICON_MAX_LENGTH } from '../../config/constants';

const PRESET_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

const AOModal = ({ isOpen, mode, aoForm, aoNameError, aoIconError, aoSaving, visibleCompanies, currentUserRole, onClose, onChange, onSubmit }) => {
  const companyColor = visibleCompanies.find((c) => c._id === aoForm.companyId)?.color;
  const swatches = companyColor ? [companyColor, ...PRESET_COLORS] : PRESET_COLORS;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === 'create' ? 'Save Area Overlay' : 'Edit Area Overlay'} size="small" closeOnBackdrop={false}>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-gold">Owning Company</label>
          <select className="dark-input w-full" value={aoForm.companyId} onChange={(e) => onChange({ companyId: e.target.value })} disabled={visibleCompanies.length === 1 && currentUserRole !== 'admin'}>
            <option value="" disabled>Select company</option>
            {visibleCompanies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gold">AO Name</label>
          <input className="dark-input w-full" type="text" placeholder="e.g. North Sector" value={aoForm.name} onChange={(e) => onChange({ name: e.target.value })} />
          {aoNameError && <p className="text-xs text-red-400">{aoNameError}</p>}
          <p className="text-xs text-gold/40">{AO_NAME_MIN}–{AO_NAME_MAX} characters</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gold">Overlay Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {swatches.map((hex, i) => (
              <button
                key={hex}
                type="button"
                title={i === 0 && companyColor ? 'Company color' : hex}
                onClick={() => onChange({ color: hex })}
                className="w-8 h-8 rounded-full border-2 transition-all duration-100 flex-shrink-0"
                style={{
                  backgroundColor: hex,
                  borderColor: aoForm.color === hex ? '#ffffff' : 'transparent',
                  boxShadow: aoForm.color === hex ? `0 0 0 1px ${hex}` : 'none',
                }}
              />
            ))}
            <input
              type="color"
              value={aoForm.color}
              onChange={(e) => onChange({ color: e.target.value })}
              title="Custom color"
              className="w-8 h-8 rounded-full border-2 border-gold/30 bg-transparent cursor-pointer flex-shrink-0 p-0.5"
              style={{ borderColor: !swatches.includes(aoForm.color) ? '#ffffff' : 'rgba(199,167,108,0.3)' }}
            />
          </div>
          <p className="text-xs text-gold/40">First swatch is the company default. Rightmost dot opens a full color picker.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gold">Overlay Icon</label>
          <div className="flex items-center space-x-3">
            <span className="h-10 w-10 rounded-full border border-gold/30 flex items-center justify-center text-sm text-white flex-shrink-0" style={{ backgroundColor: aoForm.color }}>
              {aoForm.icon && isImageUrl(aoForm.icon) ? <img src={aoForm.icon} alt="" className="h-5 w-5" /> : (aoForm.icon || '').slice(0, 2)}
            </span>
            <input className="dark-input w-full" type="text" placeholder="Company icon" value={aoForm.icon} onChange={(e) => onChange({ icon: e.target.value })} disabled />
          </div>
          <p className="text-xs text-gold/60">Icon derives from the owning company identity.</p>
          {aoIconError && <p className="text-xs text-red-400">{aoIconError}</p>}
        </div>
        <div className="flex items-center justify-end space-x-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={aoSaving || !!aoIconError || !!aoNameError}>
            {aoSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AOModal;
