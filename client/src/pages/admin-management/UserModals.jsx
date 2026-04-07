import React from 'react';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const UserModal = ({ isOpen, mode, form, operationalRoles, activeUnits, activeCompanies, activeTeams, activeSquads, onChange, onClose, onSubmit }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`${mode === 'create' ? 'Create' : 'Edit'} User`} size="large">
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Name" value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
        <Input label="Email" value={form.email} onChange={(e) => onChange({ email: e.target.value })} />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gold">Role</label>
        <select className="dark-input w-full" value={form.role} onChange={(e) => onChange({ role: e.target.value })}>
          {operationalRoles.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gold">Unit</label>
          <select className="dark-input w-full" value={form.unitId} onChange={(e) => onChange({ unitId: e.target.value, companyId: '', teamId: '', squadId: '' })}>
            <option value="">Select unit</option>
            {activeUnits.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gold">Company</label>
          <select className="dark-input w-full" value={form.companyId} onChange={(e) => onChange({ companyId: e.target.value, teamId: '', squadId: '' })}>
            <option value="">Select company</option>
            {activeCompanies.filter((c) => !form.unitId || c.parentId === form.unitId).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gold">Team</label>
          <select className="dark-input w-full" value={form.teamId} onChange={(e) => onChange({ teamId: e.target.value, squadId: '' })}>
            <option value="">Select team</option>
            {activeTeams.filter((t) => !form.companyId || t.parentId === form.companyId).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gold">Squad</label>
          <select className="dark-input w-full" value={form.squadId} onChange={(e) => onChange({ squadId: e.target.value })}>
            <option value="">Select squad</option>
            {activeSquads.filter((s) => !form.teamId || s.parentId === form.teamId).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gold/70"><input type="checkbox" checked={form.active} onChange={(e) => onChange({ active: e.target.checked })} />Active</label>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={onSubmit}>{mode === 'create' ? 'Create' : 'Save'}</Button></div>
    </div>
  </Modal>
);

export const RolesModal = ({ isOpen, form, allowableRoles, onChange, onClose, onSubmit }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Update User Roles">
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gold">System Role</label>
        <select className="dark-input w-full" value={form.role} onChange={(e) => onChange({ role: e.target.value })}>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gold">Operational Role</label>
        <select className="dark-input w-full" value={form.operationalRole} onChange={(e) => onChange({ operationalRole: e.target.value })}>
          {allowableRoles.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={onSubmit}>Save Roles</Button></div>
    </div>
  </Modal>
);

export const ConfirmModal = ({ isOpen, title, message, onConfirm, onClose }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title || 'Confirm'}>
    <div className="space-y-4">
      <p className="text-gold/80">{message}</p>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={onConfirm}>Confirm</Button></div>
    </div>
  </Modal>
);
