import React from 'react';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const CompanyModal = ({ isOpen, mode, form, activeUnits, hierarchyMap, onChange, onClose, onSubmit }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`${mode === 'create' ? 'Create' : 'Edit'} Company`}>
    <div className="space-y-4">
      <Input label="Company name" value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
      {mode === 'create' ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gold">Unit</label>
          <select className="dark-input w-full" value={form.unitId} onChange={(e) => onChange({ unitId: e.target.value })}>
            <option value="">Select unit</option>
            {activeUnits.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        </div>
      ) : (
        <div className="space-y-1 text-sm text-gold/60"><div>Unit: {hierarchyMap.units[form.unitId] || form.unitId}</div></div>
      )}
      <Input label="Commander ID (optional)" value={form.commanderId} onChange={(e) => onChange({ commanderId: e.target.value })} />
      <label className="flex items-center gap-2 text-sm text-gold/70"><input type="checkbox" checked={form.active} onChange={(e) => onChange({ active: e.target.checked })} />Active</label>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={onSubmit}>{mode === 'create' ? 'Create' : 'Save'}</Button></div>
    </div>
  </Modal>
);

export const TeamModal = ({ isOpen, mode, form, activeCompanies, onChange, onClose, onSubmit }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`${mode === 'create' ? 'Create' : 'Edit'} Team`}>
    <div className="space-y-4">
      <Input label="Team name" value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gold">Company</label>
        <select className="dark-input w-full" value={form.companyId} onChange={(e) => onChange({ companyId: e.target.value })}>
          <option value="">Select company</option>
          {activeCompanies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>
      <Input label="Commander ID (optional)" value={form.commanderId} onChange={(e) => onChange({ commanderId: e.target.value })} />
      <label className="flex items-center gap-2 text-sm text-gold/70"><input type="checkbox" checked={form.active} onChange={(e) => onChange({ active: e.target.checked })} />Active</label>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={onSubmit}>{mode === 'create' ? 'Create' : 'Save'}</Button></div>
    </div>
  </Modal>
);

export const SquadModal = ({ isOpen, mode, form, activeTeams, onChange, onClose, onSubmit }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`${mode === 'create' ? 'Create' : 'Edit'} Squad`}>
    <div className="space-y-4">
      <Input label="Squad name" value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gold">Team</label>
        <select className="dark-input w-full" value={form.teamId} onChange={(e) => onChange({ teamId: e.target.value })}>
          <option value="">Select team</option>
          {activeTeams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
      </div>
      <Input label="Commander ID (optional)" value={form.commanderId} onChange={(e) => onChange({ commanderId: e.target.value })} />
      <label className="flex items-center gap-2 text-sm text-gold/70"><input type="checkbox" checked={form.active} onChange={(e) => onChange({ active: e.target.checked })} />Active</label>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={onSubmit}>{mode === 'create' ? 'Create' : 'Save'}</Button></div>
    </div>
  </Modal>
);
