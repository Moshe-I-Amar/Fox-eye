import React from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';

const SignalConfirmModal = ({ pending, sending, noGps, onClose, onConfirm }) => (
  <Modal isOpen={!!pending} onClose={onClose} title="Confirm Signal" size="small" closeOnBackdrop={!sending}>
    {pending && (
      <div className="space-y-4">
        <div className={`rounded-lg border p-4 text-center ${pending.confirmBg}`}>
          <div className="text-xl font-bold text-white tracking-widest">{pending.label}</div>
          <div className="text-xs text-white/60 mt-1">{pending.sublabel}</div>
        </div>
        <p className="text-gold/70 text-sm text-center">This will alert your command chain immediately.</p>
        {noGps && (
          <p className="text-amber-300/80 text-xs text-center">
            No GPS fix — coordinates will be omitted from the report.
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={onConfirm} disabled={sending}>
            {sending ? 'Sending…' : 'Confirm Send'}
          </Button>
        </div>
      </div>
    )}
  </Modal>
);

export default SignalConfirmModal;
