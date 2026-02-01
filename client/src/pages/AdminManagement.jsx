
import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { adminApi } from '../services/adminApi';

const operationalRoles = [
  'SQUAD_COMMANDER',
  'TEAM_COMMANDER',
  'COMPANY_COMMANDER',
  'UNIT_COMMANDER',
  'HQ'
];

const emptyCompanyForm = {
  name: '',
  unitId: '',
  commanderId: '',
  active: true
};

const emptyTeamForm = {
  name: '',
  companyId: '',
  commanderId: '',
  active: true
};

const emptySquadForm = {
  name: '',
  teamId: '',
  commanderId: '',
  active: true
};

const emptyUserForm = {
  name: '',
  email: '',
  role: 'SQUAD_COMMANDER',
  unitId: '',
  companyId: '',
  teamId: '',
  squadId: '',
  active: true
};

const AdminManagement = () => {
  const [activeTab, setActiveTab] = useState('companies');
  const [searchTerm, setSearchTerm] = useState('');
  const [hierarchy, setHierarchy] = useState({
    units: [],
    companies: [],
    teams: [],
    squads: []
  });
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

  const hierarchyMap = useMemo(() => {
    const map = { units: {}, companies: {}, teams: {}, squads: {} };
    hierarchy.units.forEach((unit) => { map.units[unit._id] = unit.name; });
    hierarchy.companies.forEach((company) => { map.companies[company._id] = company.name; });
    hierarchy.teams.forEach((team) => { map.teams[team._id] = team.name; });
    hierarchy.squads.forEach((squad) => { map.squads[squad._id] = squad.name; });
    return map;
  }, [hierarchy]);

  const activeUnits = useMemo(
    () => hierarchy.units.filter((unit) => unit.active !== false),
    [hierarchy.units]
  );
  const activeCompanies = useMemo(
    () => hierarchy.companies.filter((company) => company.active !== false),
    [hierarchy.companies]
  );
  const activeTeams = useMemo(
    () => hierarchy.teams.filter((team) => team.active !== false),
    [hierarchy.teams]
  );
  const activeSquads = useMemo(
    () => hierarchy.squads.filter((squad) => squad.active !== false),
    [hierarchy.squads]
  );

  const companiesByUnit = useMemo(() => {
    const map = new Map();
    hierarchy.companies.forEach((company) => {
      const key = company.parentId || 'unassigned';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(company);
    });
    return map;
  }, [hierarchy.companies]);

  const teamsByCompany = useMemo(() => {
    const map = new Map();
    hierarchy.teams.forEach((team) => {
      const key = team.parentId || 'unassigned';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(team);
    });
    return map;
  }, [hierarchy.teams]);

  const squadsByTeam = useMemo(() => {
    const map = new Map();
    hierarchy.squads.forEach((squad) => {
      const key = squad.parentId || 'unassigned';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(squad);
    });
    return map;
  }, [hierarchy.squads]);

  useEffect(() => {
    let isActive = true;
    const loadHierarchy = async () => {
      try {
        setHierarchyLoading(true);
        const data = await adminApi.getHierarchyTree();
        if (!isActive) return;
        setHierarchy({
          units: data.units || [],
          companies: data.companies || [],
          teams: data.teams || [],
          squads: data.squads || []
        });
      } catch (error) {
        if (!isActive) return;
        setBanner({ type: 'error', message: error.message || 'Failed to load hierarchy' });
      } finally {
        if (isActive) {
          setHierarchyLoading(false);
        }
      }
    };

    loadHierarchy();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const loadUsers = async () => {
      try {
        setUsersLoading(true);
        const data = await adminApi.getUsers(pagination.page, pagination.limit);
        if (!isActive) return;
        setUsers(data.users || []);
        setPagination((prev) => ({
          ...prev,
          ...data.pagination
        }));
      } catch (error) {
        if (!isActive) return;
        setBanner({ type: 'error', message: error.message || 'Failed to load users' });
      } finally {
        if (isActive) {
          setUsersLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      isActive = false;
    };
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    if (!banner) return undefined;
    const timer = setTimeout(() => setBanner(null), 7000);
    return () => clearTimeout(timer);
  }, [banner]);

  const refreshHierarchy = async () => {
    const data = await adminApi.getHierarchyTree();
    setHierarchy({
      units: data.units || [],
      companies: data.companies || [],
      teams: data.teams || [],
      squads: data.squads || []
    });
  };

  const refreshUsers = async () => {
    const data = await adminApi.getUsers(pagination.page, pagination.limit);
    setUsers(data.users || []);
    setPagination((prev) => ({
      ...prev,
      ...data.pagination
    }));
  };

  const openModal = (type, mode, data = null) => {
    setModalState({ type, mode, data });
    if (type === 'company') {
      setCompanyForm({
        name: data?.name || '',
        unitId: data?.parentId || '',
        commanderId: data?.commanderId || '',
        active: data?.active !== false
      });
    }
    if (type === 'team') {
      setTeamForm({
        name: data?.name || '',
        companyId: data?.parentId || '',
        commanderId: data?.commanderId || '',
        active: data?.active !== false
      });
    }
    if (type === 'squad') {
      setSquadForm({
        name: data?.name || '',
        teamId: data?.parentId || '',
        commanderId: data?.commanderId || '',
        active: data?.active !== false
      });
    }
    if (type === 'user') {
      setUserForm({
        name: data?.name || '',
        email: data?.email || '',
        role: data?.operationalRole || data?.role || 'SQUAD_COMMANDER',
        unitId: data?.unitId || '',
        companyId: data?.companyId || '',
        teamId: data?.teamId || '',
        squadId: data?.squadId || '',
        active: data?.active !== false
      });
    }
  };

  const closeModal = () => {
    setModalState({ type: null, mode: 'create', data: null });
  };

  const handleConfirm = (title, message, action) => {
    setConfirmState({ title, message, action });
  };

  const handleAction = async (action) => {
    try {
      await action();
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Action failed' });
    } finally {
      setConfirmState(null);
    }
  };

  const handleCompanySubmit = async () => {
    try {
      if (modalState.mode === 'create') {
        await adminApi.createCompany({
          name: companyForm.name,
          unitId: companyForm.unitId,
          commanderId: companyForm.commanderId || null,
          active: companyForm.active
        });
        setBanner({ type: 'success', message: 'Company created' });
      } else {
        await adminApi.updateCompany(modalState.data._id, {
          name: companyForm.name,
          commanderId: companyForm.commanderId || null,
          active: companyForm.active
        });
        setBanner({ type: 'success', message: 'Company updated' });
      }
      await refreshHierarchy();
      closeModal();
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Company action failed' });
    }
  };

  const handleTeamSubmit = async () => {
    try {
      if (modalState.mode === 'create') {
        await adminApi.createTeam({
          name: teamForm.name,
          companyId: teamForm.companyId,
          commanderId: teamForm.commanderId || null,
          active: teamForm.active
        });
        setBanner({ type: 'success', message: 'Team created' });
      } else {
        await adminApi.updateTeam(modalState.data._id, {
          name: teamForm.name,
          companyId: teamForm.companyId,
          commanderId: teamForm.commanderId || null,
          active: teamForm.active
        });
        setBanner({ type: 'success', message: 'Team updated' });
      }
      await refreshHierarchy();
      closeModal();
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Team action failed' });
    }
  };

  const handleSquadSubmit = async () => {
    try {
      if (modalState.mode === 'create') {
        await adminApi.createSquad({
          name: squadForm.name,
          teamId: squadForm.teamId,
          commanderId: squadForm.commanderId || null,
          active: squadForm.active
        });
        setBanner({ type: 'success', message: 'Squad created' });
      } else {
        await adminApi.updateSquad(modalState.data._id, {
          name: squadForm.name,
          teamId: squadForm.teamId,
          commanderId: squadForm.commanderId || null,
          active: squadForm.active
        });
        setBanner({ type: 'success', message: 'Squad updated' });
      }
      await refreshHierarchy();
      closeModal();
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Squad action failed' });
    }
  };

  const handleUserSubmit = async () => {
    try {
      if (modalState.mode === 'create') {
        const data = await adminApi.createUser({
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          unitId: userForm.unitId,
          companyId: userForm.companyId,
          teamId: userForm.teamId,
          squadId: userForm.squadId,
          active: userForm.active
        });
        const message = data.tempPassword
          ? `User created. Temporary password: ${data.tempPassword}`
          : 'User created';
        setBanner({ type: 'success', message });
      } else {
        await adminApi.updateUser(modalState.data._id, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          unitId: userForm.unitId,
          companyId: userForm.companyId,
          teamId: userForm.teamId,
          squadId: userForm.squadId,
          active: userForm.active
        });
        setBanner({ type: 'success', message: 'User updated' });
      }
      await refreshUsers();
      closeModal();
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'User action failed' });
    }
  };

  const handleToggleCompany = (company) => {
    if (company.active === false) {
      return handleConfirm(
        'Activate company?',
        `Activate ${company.name}?`,
        async () => {
          await adminApi.updateCompany(company._id, { active: true });
          await refreshHierarchy();
          setBanner({ type: 'success', message: 'Company activated' });
        }
      );
    }
    return handleConfirm(
      'Deactivate company?',
      `Deactivate ${company.name}? Active child teams, squads, or users will block this action.`,
      async () => {
        await adminApi.deactivateCompany(company._id);
        await refreshHierarchy();
        setBanner({ type: 'success', message: 'Company deactivated' });
      }
    );
  };

  const handleToggleTeam = (team) => {
    if (team.active === false) {
      return handleConfirm(
        'Activate team?',
        `Activate ${team.name}?`,
        async () => {
          await adminApi.updateTeam(team._id, { active: true });
          await refreshHierarchy();
          setBanner({ type: 'success', message: 'Team activated' });
        }
      );
    }
    return handleConfirm(
      'Deactivate team?',
      `Deactivate ${team.name}? Active squads or users will block this action.`,
      async () => {
        await adminApi.deactivateTeam(team._id);
        await refreshHierarchy();
        setBanner({ type: 'success', message: 'Team deactivated' });
      }
    );
  };

  const handleToggleSquad = (squad) => {
    if (squad.active === false) {
      return handleConfirm(
        'Activate squad?',
        `Activate ${squad.name}?`,
        async () => {
          await adminApi.updateSquad(squad._id, { active: true });
          await refreshHierarchy();
          setBanner({ type: 'success', message: 'Squad activated' });
        }
      );
    }
    return handleConfirm(
      'Deactivate squad?',
      `Deactivate ${squad.name}? Active users will block this action.`,
      async () => {
        await adminApi.deactivateSquad(squad._id);
        await refreshHierarchy();
        setBanner({ type: 'success', message: 'Squad deactivated' });
      }
    );
  };

  const handleToggleUser = (user) => {
    const actionLabel = user.active === false ? 'Activate' : 'Deactivate';
    return handleConfirm(
      `${actionLabel} user?`,
      `${actionLabel} ${user.name}?`,
      async () => {
        await adminApi.setUserActive(user._id, user.active === false);
        await refreshUsers();
        setBanner({ type: 'success', message: `User ${actionLabel.toLowerCase()}d` });
      }
    );
  };

  const filteredCompanies = hierarchy.companies.filter((company) =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredTeams = hierarchy.teams.filter((team) =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredSquads = hierarchy.squads.filter((squad) =>
    squad.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderStatusPill = (active) => (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        active ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="px-6 pt-6">
        {banner && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              banner.type === 'error'
                ? 'border-red-500/40 bg-red-500/10 text-red-200'
                : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
            }`}
          >
            {banner.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 max-w-7xl mx-auto">
          <Card glass className="h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gold">Hierarchy</h2>
                <p className="text-xs text-gold/50">Unit {'>'} Company {'>'} Team {'>'} Squad</p>
              </div>
            </div>
            {hierarchyLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="loading-skeleton h-6 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin pr-2">
                {hierarchy.units.length === 0 && (
                  <div className="text-sm text-gold/60">No units found.</div>
                )}
                {hierarchy.units.map((unit) => (
                  <div key={unit._id}>
                    <div className="flex items-center justify-between">
                      <div className="text-gold font-semibold">{unit.name}</div>
                      {renderStatusPill(unit.active !== false)}
                    </div>
                    <div className="ml-3 mt-2 space-y-3 border-l border-gold/20 pl-3">
                      {(companiesByUnit.get(unit._id) || []).map((company) => (
                        <div key={company._id}>
                          <div className="flex items-center justify-between text-sm text-gold/80">
                            <span>{company.name}</span>
                            {renderStatusPill(company.active !== false)}
                          </div>
                          <div className="ml-3 mt-2 space-y-2 border-l border-gold/10 pl-3">
                            {(teamsByCompany.get(company._id) || []).map((team) => (
                              <div key={team._id}>
                                <div className="flex items-center justify-between text-xs text-gold/70">
                                  <span>{team.name}</span>
                                  {renderStatusPill(team.active !== false)}
                                </div>
                                <div className="ml-3 mt-2 space-y-1 border-l border-gold/5 pl-3">
                                  {(squadsByTeam.get(team._id) || []).map((squad) => (
                                    <div key={squad._id} className="flex items-center justify-between text-[11px] text-gold/60">
                                      <span>{squad.name}</span>
                                      {renderStatusPill(squad.active !== false)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gold">Admin Management</h1>
                <p className="text-gold/60">Manage hierarchy and users with full audit coverage.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activeTab === 'companies' ? 'primary' : 'outline'}
                  onClick={() => setActiveTab('companies')}
                >
                  Companies
                </Button>
                <Button
                  variant={activeTab === 'teams' ? 'primary' : 'outline'}
                  onClick={() => setActiveTab('teams')}
                >
                  Teams
                </Button>
                <Button
                  variant={activeTab === 'squads' ? 'primary' : 'outline'}
                  onClick={() => setActiveTab('squads')}
                >
                  Squads
                </Button>
                <Button
                  variant={activeTab === 'users' ? 'primary' : 'outline'}
                  onClick={() => setActiveTab('users')}
                >
                  Users
                </Button>
              </div>
            </div>

            <Card glass>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <Input
                  placeholder={`Search ${activeTab}...`}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="bg-transparent"
                />
                <Button
                  onClick={() => openModal(
                    { companies: 'company', teams: 'team', squads: 'squad', users: 'user' }[activeTab],
                    'create'
                  )}
                >
                  Create
                </Button>
              </div>
            </Card>

            {activeTab === 'companies' && (
              <Card glass>
                {hierarchyLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="loading-skeleton h-12 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gold/20 text-left text-sm text-gold/70">
                          <th className="py-3 px-4">Company</th>
                          <th className="py-3 px-4">Unit</th>
                          <th className="py-3 px-4">Commander</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCompanies.length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-gold/60">
                              {searchTerm ? 'No matching companies' : 'No companies found'}
                            </td>
                          </tr>
                        )}
                        {filteredCompanies.map((company) => (
                          <tr key={company._id} className="border-b border-gold/10">
                            <td className="py-3 px-4 text-gold">{company.name}</td>
                            <td className="py-3 px-4 text-gold/70">
                              {hierarchyMap.units[company.parentId] || company.parentId || 'Unassigned'}
                            </td>
                            <td className="py-3 px-4 text-gold/70">
                              {company.commanderId || 'Unassigned'}
                            </td>
                            <td className="py-3 px-4">{renderStatusPill(company.active !== false)}</td>
                            <td className="py-3 px-4 space-x-2">
                              <Button variant="outline" size="small" onClick={() => openModal('company', 'edit', company)}>
                                Edit
                              </Button>
                              <Button variant="ghost" size="small" onClick={() => handleToggleCompany(company)}>
                                {company.active === false ? 'Activate' : 'Deactivate'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {activeTab === 'teams' && (
              <Card glass>
                {hierarchyLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="loading-skeleton h-12 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gold/20 text-left text-sm text-gold/70">
                          <th className="py-3 px-4">Team</th>
                          <th className="py-3 px-4">Company</th>
                          <th className="py-3 px-4">Commander</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTeams.length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-gold/60">
                              {searchTerm ? 'No matching teams' : 'No teams found'}
                            </td>
                          </tr>
                        )}
                        {filteredTeams.map((team) => (
                          <tr key={team._id} className="border-b border-gold/10">
                            <td className="py-3 px-4 text-gold">{team.name}</td>
                            <td className="py-3 px-4 text-gold/70">
                              {hierarchyMap.companies[team.parentId] || team.parentId || 'Unassigned'}
                            </td>
                            <td className="py-3 px-4 text-gold/70">
                              {team.commanderId || 'Unassigned'}
                            </td>
                            <td className="py-3 px-4">{renderStatusPill(team.active !== false)}</td>
                            <td className="py-3 px-4 space-x-2">
                              <Button variant="outline" size="small" onClick={() => openModal('team', 'edit', team)}>
                                Edit
                              </Button>
                              <Button variant="ghost" size="small" onClick={() => handleToggleTeam(team)}>
                                {team.active === false ? 'Activate' : 'Deactivate'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {activeTab === 'squads' && (
              <Card glass>
                {hierarchyLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="loading-skeleton h-12 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gold/20 text-left text-sm text-gold/70">
                          <th className="py-3 px-4">Squad</th>
                          <th className="py-3 px-4">Team</th>
                          <th className="py-3 px-4">Commander</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSquads.length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-gold/60">
                              {searchTerm ? 'No matching squads' : 'No squads found'}
                            </td>
                          </tr>
                        )}
                        {filteredSquads.map((squad) => (
                          <tr key={squad._id} className="border-b border-gold/10">
                            <td className="py-3 px-4 text-gold">{squad.name}</td>
                            <td className="py-3 px-4 text-gold/70">
                              {hierarchyMap.teams[squad.parentId] || squad.parentId || 'Unassigned'}
                            </td>
                            <td className="py-3 px-4 text-gold/70">
                              {squad.commanderId || 'Unassigned'}
                            </td>
                            <td className="py-3 px-4">{renderStatusPill(squad.active !== false)}</td>
                            <td className="py-3 px-4 space-x-2">
                              <Button variant="outline" size="small" onClick={() => openModal('squad', 'edit', squad)}>
                                Edit
                              </Button>
                              <Button variant="ghost" size="small" onClick={() => handleToggleSquad(squad)}>
                                {squad.active === false ? 'Activate' : 'Deactivate'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {activeTab === 'users' && (
              <Card glass>
                {usersLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="loading-skeleton h-12 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gold/20 text-left text-sm text-gold/70">
                          <th className="py-3 px-4">User</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4">Hierarchy</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-gold/60">
                              {searchTerm ? 'No matching users' : 'No users found'}
                            </td>
                          </tr>
                        )}
                        {filteredUsers.map((user) => (
                          <tr key={user._id} className="border-b border-gold/10">
                            <td className="py-3 px-4 text-gold">
                              <div className="space-y-1">
                                <div className="font-medium">{user.name}</div>
                                <div className="text-xs text-gold/60">{user.email}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gold/70">
                              {user.operationalRole || user.role}
                            </td>
                            <td className="py-3 px-4 text-xs text-gold/60">
                              {hierarchyMap.units[user.unitId] || 'Unit'} /
                              {` ${hierarchyMap.companies[user.companyId] || 'Company'} /`}
                              {` ${hierarchyMap.teams[user.teamId] || 'Team'} /`}
                              {` ${hierarchyMap.squads[user.squadId] || 'Squad'}`}
                            </td>
                            <td className="py-3 px-4">{renderStatusPill(user.active !== false)}</td>
                            <td className="py-3 px-4 space-x-2">
                              <Button variant="outline" size="small" onClick={() => openModal('user', 'edit', user)}>
                                Edit
                              </Button>
                              <Button variant="ghost" size="small" onClick={() => handleToggleUser(user)}>
                                {user.active === false ? 'Activate' : 'Deactivate'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-gold/20">
                    <div className="text-gold/60 text-sm">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} users
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="small"
                        onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <span className="flex items-center px-3 text-gold">
                        {pagination.page} / {pagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="small"
                        onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                        disabled={pagination.page === pagination.pages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={modalState.type === 'company'}
        onClose={closeModal}
        title={`${modalState.mode === 'create' ? 'Create' : 'Edit'} Company`}
      >
        <div className="space-y-4">
          <Input
            label="Company name"
            value={companyForm.name}
            onChange={(event) => setCompanyForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          {modalState.mode === 'create' ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gold">Unit</label>
              <select
                className="dark-input w-full"
                value={companyForm.unitId}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, unitId: event.target.value }))}
              >
                <option value="">Select unit</option>
                {activeUnits.map((unit) => (
                  <option key={unit._id} value={unit._id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1 text-sm text-gold/60">
              <div>Unit: {hierarchyMap.units[modalState.data?.parentId] || modalState.data?.parentId}</div>
            </div>
          )}
          <Input
            label="Commander ID (optional)"
            value={companyForm.commanderId}
            onChange={(event) => setCompanyForm((prev) => ({ ...prev, commanderId: event.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-gold/70">
            <input
              type="checkbox"
              checked={companyForm.active}
              onChange={(event) => setCompanyForm((prev) => ({ ...prev, active: event.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleCompanySubmit}>
              {modalState.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalState.type === 'team'}
        onClose={closeModal}
        title={`${modalState.mode === 'create' ? 'Create' : 'Edit'} Team`}
      >
        <div className="space-y-4">
          <Input
            label="Team name"
            value={teamForm.name}
            onChange={(event) => setTeamForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gold">Company</label>
            <select
              className="dark-input w-full"
              value={teamForm.companyId}
              onChange={(event) => setTeamForm((prev) => ({ ...prev, companyId: event.target.value }))}
            >
              <option value="">Select company</option>
              {activeCompanies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Commander ID (optional)"
            value={teamForm.commanderId}
            onChange={(event) => setTeamForm((prev) => ({ ...prev, commanderId: event.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-gold/70">
            <input
              type="checkbox"
              checked={teamForm.active}
              onChange={(event) => setTeamForm((prev) => ({ ...prev, active: event.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleTeamSubmit}>
              {modalState.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalState.type === 'squad'}
        onClose={closeModal}
        title={`${modalState.mode === 'create' ? 'Create' : 'Edit'} Squad`}
      >
        <div className="space-y-4">
          <Input
            label="Squad name"
            value={squadForm.name}
            onChange={(event) => setSquadForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gold">Team</label>
            <select
              className="dark-input w-full"
              value={squadForm.teamId}
              onChange={(event) => setSquadForm((prev) => ({ ...prev, teamId: event.target.value }))}
            >
              <option value="">Select team</option>
              {activeTeams.map((team) => (
                <option key={team._id} value={team._id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Commander ID (optional)"
            value={squadForm.commanderId}
            onChange={(event) => setSquadForm((prev) => ({ ...prev, commanderId: event.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-gold/70">
            <input
              type="checkbox"
              checked={squadForm.active}
              onChange={(event) => setSquadForm((prev) => ({ ...prev, active: event.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSquadSubmit}>
              {modalState.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalState.type === 'user'}
        onClose={closeModal}
        title={`${modalState.mode === 'create' ? 'Create' : 'Edit'} User`}
        size="large"
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Name"
              value={userForm.name}
              onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Input
              label="Email"
              value={userForm.email}
              onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gold">Role</label>
            <select
              className="dark-input w-full"
              value={userForm.role}
              onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value }))}
            >
              {operationalRoles.map((role) => (
                <option key={role} value={role}>
                  {role.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gold">Unit</label>
              <select
                className="dark-input w-full"
                value={userForm.unitId}
                onChange={(event) => {
                  const unitId = event.target.value;
                  setUserForm((prev) => ({
                    ...prev,
                    unitId,
                    companyId: '',
                    teamId: '',
                    squadId: ''
                  }));
                }}
              >
                <option value="">Select unit</option>
                {activeUnits.map((unit) => (
                  <option key={unit._id} value={unit._id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gold">Company</label>
              <select
                className="dark-input w-full"
                value={userForm.companyId}
                onChange={(event) => {
                  const companyId = event.target.value;
                  setUserForm((prev) => ({
                    ...prev,
                    companyId,
                    teamId: '',
                    squadId: ''
                  }));
                }}
              >
                <option value="">Select company</option>
                {activeCompanies
                  .filter((company) => !userForm.unitId || company.parentId === userForm.unitId)
                  .map((company) => (
                    <option key={company._id} value={company._id}>
                      {company.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gold">Team</label>
              <select
                className="dark-input w-full"
                value={userForm.teamId}
                onChange={(event) => {
                  const teamId = event.target.value;
                  setUserForm((prev) => ({
                    ...prev,
                    teamId,
                    squadId: ''
                  }));
                }}
              >
                <option value="">Select team</option>
                {activeTeams
                  .filter((team) => !userForm.companyId || team.parentId === userForm.companyId)
                  .map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gold">Squad</label>
              <select
                className="dark-input w-full"
                value={userForm.squadId}
                onChange={(event) => setUserForm((prev) => ({ ...prev, squadId: event.target.value }))}
              >
                <option value="">Select squad</option>
                {activeSquads
                  .filter((squad) => !userForm.teamId || squad.parentId === userForm.teamId)
                  .map((squad) => (
                    <option key={squad._id} value={squad._id}>
                      {squad.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gold/70">
            <input
              type="checkbox"
              checked={userForm.active}
              onChange={(event) => setUserForm((prev) => ({ ...prev, active: event.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleUserSubmit}>
              {modalState.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        title={confirmState?.title}
        size="small"
      >
        <div className="space-y-4">
          <p className="text-gold/70 text-sm">{confirmState?.message}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmState(null)}>Cancel</Button>
            <Button onClick={() => handleAction(confirmState.action)}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminManagement;
