import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { aoService } from '../../services/aoApi';
import { toGeoPolygon } from '../../utils/mapGeometry';
import { isValidIconValue } from '../../utils/markerUtils';
import { DEFAULT_AO_COLOR, DEFAULT_AO_ICON, AO_NAME_MIN, AO_NAME_MAX } from '../../config/constants';

const useAOHandlers = ({ setAos, fetchAOs, setAoError, companyOptions, currentUser }) => {
  const [aoDraft, setAoDraft] = useState(null);
  const [aoModalMode, setAoModalMode] = useState('create');
  const [aoForm, setAoForm] = useState({ name: '', color: DEFAULT_AO_COLOR, icon: '', pattern: '', companyId: '' });
  const [aoIconError, setAoIconError] = useState('');
  const [aoNameError, setAoNameError] = useState('');
  const [selectedAO, setSelectedAO] = useState(null);
  const [aoSaving, setAoSaving] = useState(false);
  const featureGroupRef = useRef(null);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  // Raised by handleAOSelect so the company-color effect doesn't overwrite
  // the AO's own saved color when the edit modal opens.
  const skipCompanyColorResetRef = useRef(false);

  const visibleCompanies = useMemo(() => {
    if (currentUser?.role === 'admin') return companyOptions;
    if (currentUser?.companyId) return companyOptions.filter((c) => c._id === currentUser.companyId);
    return companyOptions;
  }, [companyOptions, currentUser?.companyId, currentUser?.role]);

  const visibleCompaniesRef = useRef(visibleCompanies);
  visibleCompaniesRef.current = visibleCompanies;

  useEffect(() => {
    if (!aoForm.companyId && visibleCompanies.length) setAoForm((prev) => ({ ...prev, companyId: visibleCompanies[0]._id }));
  }, [aoForm.companyId, visibleCompanies]);

  useEffect(() => {
    // When opening the edit modal, handleAOSelect raises this flag so we
    // preserve the AO's own saved color instead of overwriting with company color.
    // The flag is consumed once here; a subsequent company dropdown change will
    // go through normally and reset to the new company's color.
    if (skipCompanyColorResetRef.current) { skipCompanyColorResetRef.current = false; return; }
    if (!aoForm.companyId) return;
    const company = companyOptions.find((c) => c._id === aoForm.companyId);
    if (!company) return;
    setAoForm((prev) => {
      const next = { ...prev, color: company.color || DEFAULT_AO_COLOR, icon: company.icon || '', pattern: company.pattern || '' };
      if (prev.color === next.color && prev.icon === next.icon && prev.pattern === next.pattern) return prev;
      return next;
    });
  }, [aoForm.companyId, companyOptions]);

  const clearDraftLayer = () => { if (featureGroupRef.current && aoDraft?.layer) featureGroupRef.current.removeLayer(aoDraft.layer); };

  const handleAOCreate = useCallback((event) => {
    if (!event?.layer) return;
    const polygon = toGeoPolygon(event.layer.getLatLngs());
    if (!polygon) return;
    const user = currentUserRef.current;
    const firstCompanyId = visibleCompaniesRef.current[0]?._id || '';
    setAoDraft({ polygon, layer: event.layer });
    setAoForm({ name: '', color: DEFAULT_AO_COLOR, icon: '', pattern: '', companyId: user?.companyId || firstCompanyId });
    setAoIconError(''); setAoNameError(''); setAoModalMode('create'); setAoError('');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAOEdit = useCallback(async (event) => {
    if (!event?.layers) return;
    const updates = [];
    event.layers.eachLayer((layer) => { const aoId = layer?.options?.aoId; const polygon = toGeoPolygon(layer.getLatLngs()); if (aoId && polygon) updates.push({ aoId, polygon }); });
    if (!updates.length) return;
    try {
      setAoSaving(true);
      await Promise.all(updates.map((u) => aoService.updateAO(u.aoId, { polygon: u.polygon })));
      setAos((prev) => prev.map((ao) => { const u = updates.find((item) => item.aoId === ao._id); return u ? { ...ao, polygon: u.polygon } : ao; }));
    } catch { setAoError('Failed to update AO geometry. Please try again.'); } finally { setAoSaving(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAODelete = useCallback(async (event) => {
    if (!event?.layers) return;
    const aoIdSet = new Set();
    event.layers.eachLayer((layer) => { const id = layer?.options?.aoId; if (id) aoIdSet.add(id); });
    const aoIds = [...aoIdSet];
    if (!aoIds.length) return;
    try {
      setAoSaving(true);
      const results = await Promise.allSettled(aoIds.map((id) => aoService.deleteAO(id).then(() => id)));
      const deletedIds = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      if (deletedIds.length) { setAos((prev) => prev.filter((ao) => !deletedIds.includes(ao._id))); setSelectedAO((prev) => (prev && deletedIds.includes(prev._id) ? null : prev)); }
      if (results.some((r) => r.status === 'rejected')) { setAoError('Failed to delete one or more overlays. Refresh to retry.'); fetchAOs(); }
    } catch { setAoError('Failed to delete overlay. Please try again.'); fetchAOs(); } finally { setAoSaving(false); }
  }, [fetchAOs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAOSelect = (ao) => {
    skipCompanyColorResetRef.current = true; // preserve ao.style.color; don't let the company effect overwrite it
    setSelectedAO(ao);
    setAoForm({ name: ao.name || '', color: ao.style?.color || DEFAULT_AO_COLOR, icon: ao.style?.icon || '', pattern: ao.style?.pattern || '', companyId: ao.companyId || currentUser?.companyId || '' });
    setAoIconError(''); setAoNameError(''); setAoModalMode('edit'); setAoError('');
  };

  const handleAOCancel = () => {
    clearDraftLayer();
    setAoDraft(null); setSelectedAO(null);
    setAoForm({ name: '', color: DEFAULT_AO_COLOR, icon: '', pattern: '', companyId: currentUser?.companyId || visibleCompanies[0]?._id || '' });
    setAoIconError(''); setAoNameError('');
  };

  const handleAOSubmit = async () => {
    const trimmedName = aoForm.name.trim();
    if (trimmedName.length < AO_NAME_MIN || trimmedName.length > AO_NAME_MAX) { setAoError(`AO name must be between ${AO_NAME_MIN} and ${AO_NAME_MAX} characters.`); return; }
    const trimmedIcon = aoForm.icon.trim();
    if (!isValidIconValue(trimmedIcon)) { setAoError(`Icon must be an image URL/path or shorter.`); return; }
    if (!aoForm.companyId) { setAoError('Owning company is required.'); return; }
    try {
      setAoSaving(true); setAoError('');
      if (aoModalMode === 'create') {
        if (!aoDraft?.polygon) return;
        const res = await aoService.createAO({ name: trimmedName, polygon: aoDraft.polygon, style: { color: aoForm.color, icon: trimmedIcon, pattern: aoForm.pattern || '' }, companyId: aoForm.companyId });
        const created = res?.ao;
        if (created) setAos((prev) => { const exists = prev.some((ao) => ao._id === created._id); return exists ? prev.map((ao) => ao._id === created._id ? created : ao) : [created, ...prev]; });
        clearDraftLayer(); setAoDraft(null);
      } else if (selectedAO) {
        const res = await aoService.updateAO(selectedAO._id, { name: trimmedName, style: { color: aoForm.color, icon: trimmedIcon, pattern: aoForm.pattern || '' }, companyId: aoForm.companyId });
        const updated = res?.ao;
        if (updated) setAos((prev) => prev.map((ao) => ao._id === updated._id ? updated : ao));
        else setAos((prev) => prev.map((ao) => ao._id === selectedAO._id ? { ...ao, name: trimmedName, style: { ...ao.style, color: aoForm.color, icon: trimmedIcon || null } } : ao));
        setSelectedAO(null);
      }
    } catch { setAoError('Failed to save AO. Please try again.'); } finally { setAoSaving(false); }
  };

  const handleAODirectDelete = useCallback(async (ao) => {
    try {
      setAoSaving(true);
      await aoService.deleteAO(ao._id);
      if (featureGroupRef.current) {
        featureGroupRef.current.eachLayer((layer) => {
          if (layer?.options?.aoId === ao._id) featureGroupRef.current.removeLayer(layer);
        });
      }
      setAos((prev) => prev.filter((a) => a._id !== ao._id));
      setSelectedAO((prev) => (prev?._id === ao._id ? null : prev));
    } catch {
      setAoError('Failed to delete AO. Please try again.');
    } finally {
      setAoSaving(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleAOActive = async (ao) => {
    try {
      const next = !ao.active;
      await aoService.setAOActive(ao._id, next);
      setAos((prev) => prev.map((item) => item._id === ao._id ? { ...item, active: next } : item));
    } catch { setAoError('Failed to update AO status. Please try again.'); }
  };

  const isAoModalOpen = (aoModalMode === 'create' && !!aoDraft) || (aoModalMode === 'edit' && !!selectedAO);

  return { aoDraft, aoModalMode, aoForm, setAoForm, aoIconError, setAoIconError, aoNameError, setAoNameError, selectedAO, aoSaving, featureGroupRef, visibleCompanies, isAoModalOpen, handleAOCreate, handleAOEdit, handleAODelete, handleAODirectDelete, handleAOSelect, handleAOCancel, handleAOSubmit, handleToggleAOActive };
};

export default useAOHandlers;
