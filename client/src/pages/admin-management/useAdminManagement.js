import { useState, useEffect, useMemo } from 'react';
import { adminApi } from '../../services/adminApi';
import { authService } from '../../services/authApi';
import { OPERATIONAL_ROLE_RANK, operationalRoles } from '../../utils/roleUtils';

const emptyCompanyForm = { name: '', unitId: '', commanderId: '', active: true };
const emptyTeamForm = { name: '', companyId: '', commanderId: '', active: true };
const emptySquadForm = { name: '', teamId: '', commanderId: '', active: true };
const emptyUserForm = { name: '', email: '', role: 'SQUAD_COMMANDER', unitId: '', companyId: '', teamId: '', squadId: '', active: true };

const useAdminManagement = () => {
  const [activeTab, setActiveTab] = useState('companies');
  const [searchTerm, setSearchTerm] = useState('');
  const [hierarchy, setHierarchy] = useState({ units: [], companies: [], teams: [], squads: [] });
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [banner, setBanner] = useState(null);
  const [modalState, setModalState] = useState({ type: null, mode: 'create', data: null });
  const [confirmState, setConfirmState] = useState(null);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [teamForm, setTeamForm] = useState(emptyTeamForm);
  const [squadForm, setSquadForm] = useState(emptySquadForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [roleForm, setRoleForm] = useState({ role: 'user', operationalRole: 'SQUAD_COMMANDER' });
  const [invites, setInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ assignedOperationalRole: '', assignedRole: 'user', unitId: '', companyId: '', teamId: '', squadId: '', expiresInDays: 7 });
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  const allowableOperationalRoles = useMemo(() => {
    const actorRank = OPERATIONAL_ROLE_RANK[currentUser?.operationalRole] ?? 0;
    return operationalRoles.filter((r) => OPERATIONAL_ROLE_RANK[r] < actorRank);
  }, [currentUser]);

  const hierarchyMap = useMemo(() => {
    const map = { units: {}, companies: {}, teams: {}, squads: {} };
    hierarchy.units.forEach((u) => { map.units[u._id] = u.name; });
    hierarchy.companies.forEach((c) => { map.companies[c._id] = c.name; });
    hierarchy.teams.forEach((t) => { map.teams[t._id] = t.name; });
    hierarchy.squads.forEach((s) => { map.squads[s._id] = s.name; });
    return map;
  }, [hierarchy]);

  const activeUnits = useMemo(() => hierarchy.units.filter((u) => u.active !== false), [hierarchy.units]);
  const activeCompanies = useMemo(() => hierarchy.companies.filter((c) => c.active !== false), [hierarchy.companies]);
  const activeTeams = useMemo(() => hierarchy.teams.filter((t) => t.active !== false), [hierarchy.teams]);
  const activeSquads = useMemo(() => hierarchy.squads.filter((s) => s.active !== false), [hierarchy.squads]);

  const companiesByUnit = useMemo(() => { const m = new Map(); hierarchy.companies.forEach((c) => { const k = c.parentId || 'unassigned'; if (!m.has(k)) m.set(k, []); m.get(k).push(c); }); return m; }, [hierarchy.companies]);
  const teamsByCompany = useMemo(() => { const m = new Map(); hierarchy.teams.forEach((t) => { const k = t.parentId || 'unassigned'; if (!m.has(k)) m.set(k, []); m.get(k).push(t); }); return m; }, [hierarchy.teams]);
  const squadsByTeam = useMemo(() => { const m = new Map(); hierarchy.squads.forEach((s) => { const k = s.parentId || 'unassigned'; if (!m.has(k)) m.set(k, []); m.get(k).push(s); }); return m; }, [hierarchy.squads]);

  const refreshHierarchy = async () => { const d = await adminApi.getHierarchyTree(); setHierarchy({ units: d.units || [], companies: d.companies || [], teams: d.teams || [], squads: d.squads || [] }); };
  const refreshUsers = async () => { const d = await adminApi.getUsers(pagination.page, pagination.limit); setUsers(d.users || []); setPagination((p) => ({ ...p, ...d.pagination })); };
  const loadInvites = async () => { try { setInvitesLoading(true); const d = await adminApi.listInvites(); setInvites(d.invites || []); } catch (e) { setBanner({ type: 'error', message: e.message || 'Failed to load invites' }); } finally { setInvitesLoading(false); } };

  useEffect(() => {
    let a = true;
    (async () => { try { setHierarchyLoading(true); const d = await adminApi.getHierarchyTree(); if (!a) return; setHierarchy({ units: d.units || [], companies: d.companies || [], teams: d.teams || [], squads: d.squads || [] }); } catch (e) { if (a) setBanner({ type: 'error', message: e.message || 'Failed to load hierarchy' }); } finally { if (a) setHierarchyLoading(false); } })();
    return () => { a = false; };
  }, []);

  useEffect(() => {
    let a = true;
    (async () => { try { setUsersLoading(true); const d = await adminApi.getUsers(pagination.page, pagination.limit); if (!a) return; setUsers(d.users || []); setPagination((p) => ({ ...p, ...d.pagination })); } catch (e) { if (a) setBanner({ type: 'error', message: e.message || 'Failed to load users' }); } finally { if (a) setUsersLoading(false); } })();
    return () => { a = false; };
  }, [pagination.page, pagination.limit]);

  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), 7000); return () => clearTimeout(t); }, [banner]);
  useEffect(() => { if (activeTab === 'invites') loadInvites(); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeModal = () => setModalState({ type: null, mode: 'create', data: null });
  const handleConfirm = (title, message, action) => setConfirmState({ title, message, action });
  const handleAction = async () => { try { await confirmState.action(); } catch (e) { setBanner({ type: 'error', message: e.message || 'Action failed' }); } finally { setConfirmState(null); } };

  const openModal = (type, mode, data = null) => {
    setModalState({ type, mode, data });
    if (type === 'company') setCompanyForm({ name: data?.name || '', unitId: data?.parentId || '', commanderId: data?.commanderId || '', active: data?.active !== false });
    if (type === 'team') setTeamForm({ name: data?.name || '', companyId: data?.parentId || '', commanderId: data?.commanderId || '', active: data?.active !== false });
    if (type === 'squad') setSquadForm({ name: data?.name || '', teamId: data?.parentId || '', commanderId: data?.commanderId || '', active: data?.active !== false });
    if (type === 'user') setUserForm({ name: data?.name || '', email: data?.email || '', role: data?.operationalRole || data?.role || 'SQUAD_COMMANDER', unitId: data?.unitId || '', companyId: data?.companyId || '', teamId: data?.teamId || '', squadId: data?.squadId || '', active: data?.active !== false });
    if (type === 'userRoles') setRoleForm({ role: data?.role || 'user', operationalRole: data?.operationalRole || 'SQUAD_COMMANDER' });
    if (type === 'invite') { setInviteForm({ assignedOperationalRole: allowableOperationalRoles[0] || '', assignedRole: 'user', unitId: '', companyId: '', teamId: '', squadId: '', expiresInDays: 7 }); setGeneratedLink(null); setCopiedLink(false); }
  };

  const handleCompanySubmit = async () => { try { if (modalState.mode === 'create') { await adminApi.createCompany({ name: companyForm.name, unitId: companyForm.unitId, commanderId: companyForm.commanderId || null, active: companyForm.active }); setBanner({ type: 'success', message: 'Company created' }); } else { await adminApi.updateCompany(modalState.data._id, { name: companyForm.name, commanderId: companyForm.commanderId || null, active: companyForm.active }); setBanner({ type: 'success', message: 'Company updated' }); } await refreshHierarchy(); closeModal(); } catch (e) { setBanner({ type: 'error', message: e.message || 'Company action failed' }); } };
  const handleTeamSubmit = async () => { try { if (modalState.mode === 'create') { await adminApi.createTeam({ name: teamForm.name, companyId: teamForm.companyId, commanderId: teamForm.commanderId || null, active: teamForm.active }); setBanner({ type: 'success', message: 'Team created' }); } else { await adminApi.updateTeam(modalState.data._id, { name: teamForm.name, companyId: teamForm.companyId, commanderId: teamForm.commanderId || null, active: teamForm.active }); setBanner({ type: 'success', message: 'Team updated' }); } await refreshHierarchy(); closeModal(); } catch (e) { setBanner({ type: 'error', message: e.message || 'Team action failed' }); } };
  const handleSquadSubmit = async () => { try { if (modalState.mode === 'create') { await adminApi.createSquad({ name: squadForm.name, teamId: squadForm.teamId, commanderId: squadForm.commanderId || null, active: squadForm.active }); setBanner({ type: 'success', message: 'Squad created' }); } else { await adminApi.updateSquad(modalState.data._id, { name: squadForm.name, teamId: squadForm.teamId, commanderId: squadForm.commanderId || null, active: squadForm.active }); setBanner({ type: 'success', message: 'Squad updated' }); } await refreshHierarchy(); closeModal(); } catch (e) { setBanner({ type: 'error', message: e.message || 'Squad action failed' }); } };
  const handleUserSubmit = async () => { try { if (modalState.mode === 'create') { const d = await adminApi.createUser({ name: userForm.name, email: userForm.email, role: userForm.role, unitId: userForm.unitId, companyId: userForm.companyId, teamId: userForm.teamId, squadId: userForm.squadId, active: userForm.active }); setBanner({ type: 'success', message: d.tempPassword ? `User created. Temporary password: ${d.tempPassword}` : 'User created' }); } else { await adminApi.updateUser(modalState.data._id, userForm); setBanner({ type: 'success', message: 'User updated' }); } await refreshUsers(); closeModal(); } catch (e) { setBanner({ type: 'error', message: e.message || 'User action failed' }); } };
  const handleRoleSubmit = async () => { try { await adminApi.patchUserRoles(modalState.data._id, roleForm); setBanner({ type: 'success', message: 'User roles updated' }); await refreshUsers(); closeModal(); } catch (e) { setBanner({ type: 'error', message: e.message || 'Failed to update roles' }); } };
  const handleInviteSubmit = async () => { try { const d = await adminApi.createInvite(inviteForm); setGeneratedLink(`${window.location.origin}/register?token=${d.invite.token}`); setCopiedLink(false); await loadInvites(); } catch (e) { setBanner({ type: 'error', message: e.message || 'Failed to create invite' }); } };
  const handleCopyLink = () => navigator.clipboard.writeText(generatedLink).then(() => { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); });

  const handleToggleCompany = (company) => handleConfirm(company.active === false ? 'Activate company?' : 'Deactivate company?', company.active === false ? `Activate ${company.name}?` : `Deactivate ${company.name}? Active child teams, squads, or users will block this action.`, async () => { if (company.active === false) await adminApi.updateCompany(company._id, { active: true }); else await adminApi.deactivateCompany(company._id); await refreshHierarchy(); setBanner({ type: 'success', message: `Company ${company.active === false ? 'activated' : 'deactivated'}` }); });
  const handleToggleTeam = (team) => handleConfirm(team.active === false ? 'Activate team?' : 'Deactivate team?', team.active === false ? `Activate ${team.name}?` : `Deactivate ${team.name}? Active squads or users will block this action.`, async () => { if (team.active === false) await adminApi.updateTeam(team._id, { active: true }); else await adminApi.deactivateTeam(team._id); await refreshHierarchy(); setBanner({ type: 'success', message: `Team ${team.active === false ? 'activated' : 'deactivated'}` }); });
  const handleToggleSquad = (squad) => handleConfirm(squad.active === false ? 'Activate squad?' : 'Deactivate squad?', squad.active === false ? `Activate ${squad.name}?` : `Deactivate ${squad.name}? Active users will block this action.`, async () => { if (squad.active === false) await adminApi.updateSquad(squad._id, { active: true }); else await adminApi.deactivateSquad(squad._id); await refreshHierarchy(); setBanner({ type: 'success', message: `Squad ${squad.active === false ? 'activated' : 'deactivated'}` }); });
  const handleToggleUser = (user) => handleConfirm(`${user.active === false ? 'Activate' : 'Deactivate'} user?`, `${user.active === false ? 'Activate' : 'Deactivate'} ${user.name}?`, async () => { await adminApi.setUserActive(user._id, user.active === false); await refreshUsers(); setBanner({ type: 'success', message: `User ${user.active === false ? 'activated' : 'deactivated'}` }); });

  const filteredCompanies = hierarchy.companies.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredTeams = hierarchy.teams.filter((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredSquads = hierarchy.squads.filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredUsers = users.filter((u) => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()));

  return {
    activeTab, setActiveTab, searchTerm, setSearchTerm, hierarchy, hierarchyLoading, users, usersLoading, pagination, setPagination, banner, setBanner, modalState, confirmState, setConfirmState, companyForm, setCompanyForm, teamForm, setTeamForm, squadForm, setSquadForm, userForm, setUserForm, roleForm, setRoleForm, invites, invitesLoading, inviteForm, setInviteForm, generatedLink, copiedLink, currentUser, allowableOperationalRoles, hierarchyMap, activeUnits, activeCompanies, activeTeams, activeSquads, companiesByUnit, teamsByCompany, squadsByTeam, filteredCompanies, filteredTeams, filteredSquads, filteredUsers, openModal, closeModal, handleConfirm, handleAction, handleCompanySubmit, handleTeamSubmit, handleSquadSubmit, handleUserSubmit, handleRoleSubmit, handleInviteSubmit, handleCopyLink, handleToggleCompany, handleToggleTeam, handleToggleSquad, handleToggleUser, loadInvites, operationalRoles,
  };
};

export default useAdminManagement;
