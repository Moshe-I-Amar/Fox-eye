import React from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { isImageUrl } from '../../utils/markerUtils';
import { AO_NAME_MIN, AO_NAME_MAX, AO_ICON_MAX_LENGTH } from '../../config/constants';

const AOModal = ({ isOpen, mode, aoForm, aoNameError, aoIconError, aoSaving, visibleCompanies, currentUserRole, onClose, onChange, onSubmit }) => (
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
        <input className="dark-input w-full" type="text" placeholder="e.g. North Sector" value={aoForm.name} onChange={(e) => {
          const v = e.target.value;
          onChange({ name: v });
        }} />
        {aoNameError && <p className="text-xs text-red-400">{aoNameError}</p>}
        <p className="text-xs text-gold/40">{AO_NAME_MIN}–{AO_NAME_MAX} characters</p>
      </div>
      <div className="space-y-2">
        <label className="text-sm text-gold">Overlay Color</label>
        <input type="color" value={aoForm.color} onChange={(e) => onChange({ color: e.target.value })} className="h-10 w-20 rounded border border-gold/30 bg-transparent" disabled />
        <p className="text-xs text-gold/60">Color derives from the owning company identity.</p>
      </div>
      <div className="space-y-2">
        <label className="text-sm text-gold">Overlay Icon</label>
        <div className="flex items-center space-x-3">
          <span className="h-10 w-10 rounded-full border border-gold/30 flex items-center justify-center text-sm text-white" style={{ backgroundColor: aoForm.color }}>
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

export default AOModal;
