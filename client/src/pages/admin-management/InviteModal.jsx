import React from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

const InviteModal = ({ isOpen, form, allowableRoles, activeUnits, activeCompanies, activeTeams, activeSquads, generatedLink, copiedLink, onChange, onClose, onSubmit, onCopyLink }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Generate Invite Link">
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gold">Operational Role</label>
        <select className="dark-input w-full" value={form.assignedOperationalRole} onChange={(e) => onChange({ assignedOperationalRole: e.target.value })}>
          <option value="">Select role</option>
          {allowableRoles.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className="grid gap-3 grid-cols-2">
        {[['Unit', 'unitId', activeUnits], ['Company', 'companyId', activeCompanies], ['Team', 'teamId', activeTeams], ['Squad', 'squadId', activeSquads]].map(([label, key, items]) => (
          <div key={key} className="space-y-1">
            <label className="block text-xs font-medium text-gold/70">{label}</label>
            <select className="dark-input w-full text-xs" value={form[key]} onChange={(e) => onChange({ [key]: e.target.value })}>
              <option value="">Any</option>
              {items.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gold">Expires in (days)</label>
        <input type="number" min="1" max="30" className="dark-input w-full" value={form.expiresInDays} onChange={(e) => onChange({ expiresInDays: Number(e.target.value) })} />
      </div>
      {generatedLink && (
        <div className="rounded-lg bg-gold/10 border border-gold/30 p-3 space-y-2">
          <p className="text-xs text-gold/60 font-medium uppercase tracking-wider">Generated Link</p>
          <p className="text-xs text-gold break-all font-mono">{generatedLink}</p>
          <Button variant="outline" size="sm" onClick={onCopyLink}>{copiedLink ? 'Copied!' : 'Copy Link'}</Button>
        </div>
      )}
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Close</Button><Button onClick={onSubmit}>Generate</Button></div>
    </div>
  </Modal>
);

export default InviteModal;
