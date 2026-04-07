import React from 'react';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import AlertBanner from '../components/ui/AlertBanner';
import { adminApi } from '../services/adminApi';
import useAdminManagement from './admin-management/useAdminManagement';
import HierarchyTree from './admin-management/HierarchyTree';
import { CompanyModal, TeamModal, SquadModal } from './admin-management/HierarchyModals';
import { UserModal, RolesModal, ConfirmModal } from './admin-management/UserModals';
import InviteModal from './admin-management/InviteModal';

const renderStatusPill = (active) => <Badge variant={active ? 'green' : 'red'} size="sm">{active ? 'Active' : 'Inactive'}</Badge>;

const AdminManagement = () => {
  const s = useAdminManagement();

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="px-6 pt-6">
        {s.banner && <AlertBanner message={s.banner.message} tone={s.banner.type === 'error' ? 'error' : 'success'} onDismiss={() => s.setBanner(null)} className="mb-6" />}

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 max-w-7xl mx-auto">
          <HierarchyTree hierarchy={s.hierarchy} hierarchyLoading={s.hierarchyLoading} companiesByUnit={s.companiesByUnit} teamsByCompany={s.teamsByCompany} squadsByTeam={s.squadsByTeam} />

          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><h1 className="text-3xl font-bold text-gold">Admin Management</h1><p className="text-gold/60">Manage hierarchy and users with full audit coverage.</p></div>
              <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-thin">
                {['companies', 'teams', 'squads', 'users', 'invites'].map((tab) => <Button key={tab} variant={s.activeTab === tab ? 'primary' : 'outline'} size="sm" onClick={() => s.setActiveTab(tab)} className="shrink-0 min-h-[44px] capitalize">{tab}</Button>)}
              </div>
            </div>

            <Card glass>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {s.activeTab !== 'invites' && <Input placeholder={`Search ${s.activeTab}...`} value={s.searchTerm} onChange={(e) => s.setSearchTerm(e.target.value)} className="bg-transparent" />}
                {s.activeTab === 'invites' ? <div className="flex items-center gap-2"><span className="text-sm text-gold/60">Generate a one-time invite link for a new member</span><Button onClick={() => s.openModal('invite', 'create')}>Generate Invite</Button></div>
                  : <Button onClick={() => s.openModal({ companies: 'company', teams: 'team', squads: 'squad', users: 'user' }[s.activeTab], 'create')}>Create</Button>}
              </div>
            </Card>

            {s.activeTab === 'companies' && <Card glass><Table loading={s.hierarchyLoading} data={s.filteredCompanies} pageSize={0} emptyMessage={s.searchTerm ? 'No matching companies' : 'No companies defined yet'} columns={[
              { key: 'name', label: 'Company', sortable: true, render: (v) => <span className="text-gold font-medium">{v}</span> },
              { key: 'parentId', label: 'Unit', render: (v) => <span className="text-gold/70">{s.hierarchyMap.units[v] || v || 'Unassigned'}</span> },
              { key: 'commanderId', label: 'Commander', render: (v) => <span className="text-gold/70">{v || 'Unassigned'}</span> },
              { key: 'active', label: 'Status', render: (_, r) => renderStatusPill(r.active !== false) },
              { key: '_id', label: 'Actions', render: (_, c) => <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => s.openModal('company', 'edit', c)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => s.handleToggleCompany(c)}>{c.active === false ? 'Activate' : 'Deactivate'}</Button></div> },
            ]} /></Card>}

            {s.activeTab === 'teams' && <Card glass><Table loading={s.hierarchyLoading} data={s.filteredTeams} pageSize={0} emptyMessage={s.searchTerm ? 'No matching teams' : 'No teams defined yet'} columns={[
              { key: 'name', label: 'Team', sortable: true, render: (v) => <span className="text-gold font-medium">{v}</span> },
              { key: 'parentId', label: 'Company', render: (v) => <span className="text-gold/70">{s.hierarchyMap.companies[v] || v || 'Unassigned'}</span> },
              { key: 'commanderId', label: 'Commander', render: (v) => <span className="text-gold/70">{v || 'Unassigned'}</span> },
              { key: 'active', label: 'Status', render: (_, r) => renderStatusPill(r.active !== false) },
              { key: '_id', label: 'Actions', render: (_, t) => <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => s.openModal('team', 'edit', t)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => s.handleToggleTeam(t)}>{t.active === false ? 'Activate' : 'Deactivate'}</Button></div> },
            ]} /></Card>}

            {s.activeTab === 'squads' && <Card glass><Table loading={s.hierarchyLoading} data={s.filteredSquads} pageSize={0} emptyMessage={s.searchTerm ? 'No matching squads' : 'No squads defined yet'} columns={[
              { key: 'name', label: 'Squad', sortable: true, render: (v) => <span className="text-gold font-medium">{v}</span> },
              { key: 'parentId', label: 'Team', render: (v) => <span className="text-gold/70">{s.hierarchyMap.teams[v] || v || 'Unassigned'}</span> },
              { key: 'commanderId', label: 'Commander', render: (v) => <span className="text-gold/70">{v || 'Unassigned'}</span> },
              { key: 'active', label: 'Status', render: (_, r) => renderStatusPill(r.active !== false) },
              { key: '_id', label: 'Actions', render: (_, sq) => <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => s.openModal('squad', 'edit', sq)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => s.handleToggleSquad(sq)}>{sq.active === false ? 'Activate' : 'Deactivate'}</Button></div> },
            ]} /></Card>}

            {s.activeTab === 'invites' && <Card glass><Table loading={s.invitesLoading} data={s.invites} pageSize={0} emptyMessage="No invites generated yet" columns={[
              { key: 'assignedOperationalRole', label: 'Assigned Role', render: (v, r) => <div className="space-y-1"><Badge variant="gold" size="sm">{v}</Badge>{r.assignedRole === 'admin' && <Badge variant="blue" size="sm">admin</Badge>}</div> },
              { key: 'unitId', label: 'Assignment', render: (_, inv) => <span className="text-xs text-gold/60">{s.hierarchyMap.units[inv.unitId] || '?'} / {s.hierarchyMap.companies[inv.companyId] || '?'} / {s.hierarchyMap.teams[inv.teamId] || '?'} / {s.hierarchyMap.squads[inv.squadId] || '?'}</span> },
              { key: 'inviterName', label: 'Created By', render: (v, r) => <span className="text-gold/70">{r.createdBy?.name || v || '—'}</span> },
              { key: 'expiresAt', label: 'Expires', render: (v) => <span className="text-xs text-gold/60">{new Date(v).toLocaleDateString()}</span> },
              { key: '_id', label: 'Status', render: (_, inv) => { const now = new Date(); if (inv.usedAt) return <Badge variant="green" size="sm">Used</Badge>; if (!inv.active || new Date(inv.expiresAt) <= now) return <Badge variant="red" size="sm">Expired</Badge>; return <Badge variant="gold" size="sm">Active</Badge>; } },
              { key: '_id', label: 'Actions', render: (id, inv) => { const isActive = inv.active && !inv.usedAt && new Date(inv.expiresAt) > new Date(); return isActive ? <Button variant="ghost" size="sm" onClick={() => s.handleConfirm('Revoke invite?', 'This invite link will immediately stop working.', async () => { await adminApi.revokeInvite(id); await s.loadInvites(); s.setBanner({ type: 'success', message: 'Invite revoked' }); })}>Revoke</Button> : null; } },
            ]} /></Card>}

            {s.activeTab === 'users' && <Card glass>
              <Table loading={s.usersLoading} data={s.filteredUsers} pageSize={0} emptyMessage={s.searchTerm ? 'No matching users' : 'No users found'} columns={[
                { key: 'name', label: 'User', sortable: true, render: (_, u) => <div className="space-y-0.5"><div className="font-medium text-gold">{u.name}</div><div className="text-xs text-gold/50">{u.email}</div></div> },
                { key: 'operationalRole', label: 'Role', render: (v, r) => <Badge variant="gold" size="sm">{v || r.role}</Badge> },
                { key: 'unitId', label: 'Hierarchy', render: (_, u) => <span className="text-xs text-gold/60">{s.hierarchyMap.units[u.unitId] || '?'} / {s.hierarchyMap.companies[u.companyId] || '?'} / {s.hierarchyMap.teams[u.teamId] || '?'} / {s.hierarchyMap.squads[u.squadId] || '?'}</span> },
                { key: 'active', label: 'Status', render: (_, r) => renderStatusPill(r.active !== false) },
                { key: '_id', label: 'Actions', render: (_, u) => <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => s.openModal('user', 'edit', u)}>Edit</Button>{!['HQ', 'UNIT_COMMANDER'].includes(u.operationalRole) && <Button variant="outline" size="sm" onClick={() => s.openModal('userRoles', 'edit', u)}>Roles</Button>}<Button variant="ghost" size="sm" onClick={() => s.handleToggleUser(u)}>{u.active === false ? 'Activate' : 'Deactivate'}</Button></div> },
              ]} />
              {s.pagination.pages > 1 && <div className="flex items-center justify-between mt-6 pt-4 border-t border-gold/20"><span className="text-gold/50 text-sm">{((s.pagination.page - 1) * s.pagination.limit) + 1}–{Math.min(s.pagination.page * s.pagination.limit, s.pagination.total)} of {s.pagination.total}</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => s.setPagination((p) => ({ ...p, page: p.page - 1 }))} disabled={s.pagination.page === 1}>Previous</Button><span className="text-gold text-sm">{s.pagination.page} / {s.pagination.pages}</span><Button variant="outline" size="sm" onClick={() => s.setPagination((p) => ({ ...p, page: p.page + 1 }))} disabled={s.pagination.page === s.pagination.pages}>Next</Button></div></div>}
            </Card>}
          </div>
        </div>
      </div>

      <CompanyModal isOpen={s.modalState.type === 'company'} mode={s.modalState.mode} form={s.companyForm} activeUnits={s.activeUnits} hierarchyMap={s.hierarchyMap} onChange={(p) => s.setCompanyForm((prev) => ({ ...prev, ...p }))} onClose={s.closeModal} onSubmit={s.handleCompanySubmit} />
      <TeamModal isOpen={s.modalState.type === 'team'} mode={s.modalState.mode} form={s.teamForm} activeCompanies={s.activeCompanies} onChange={(p) => s.setTeamForm((prev) => ({ ...prev, ...p }))} onClose={s.closeModal} onSubmit={s.handleTeamSubmit} />
      <SquadModal isOpen={s.modalState.type === 'squad'} mode={s.modalState.mode} form={s.squadForm} activeTeams={s.activeTeams} onChange={(p) => s.setSquadForm((prev) => ({ ...prev, ...p }))} onClose={s.closeModal} onSubmit={s.handleSquadSubmit} />
      <UserModal isOpen={s.modalState.type === 'user'} mode={s.modalState.mode} form={s.userForm} operationalRoles={s.operationalRoles} activeUnits={s.activeUnits} activeCompanies={s.activeCompanies} activeTeams={s.activeTeams} activeSquads={s.activeSquads} onChange={(p) => s.setUserForm((prev) => ({ ...prev, ...p }))} onClose={s.closeModal} onSubmit={s.handleUserSubmit} />
      <RolesModal isOpen={s.modalState.type === 'userRoles'} form={s.roleForm} allowableRoles={s.allowableOperationalRoles} onChange={(p) => s.setRoleForm((prev) => ({ ...prev, ...p }))} onClose={s.closeModal} onSubmit={s.handleRoleSubmit} />
      <InviteModal isOpen={s.modalState.type === 'invite'} form={s.inviteForm} allowableRoles={s.allowableOperationalRoles} activeUnits={s.activeUnits} activeCompanies={s.activeCompanies} activeTeams={s.activeTeams} activeSquads={s.activeSquads} generatedLink={s.generatedLink} copiedLink={s.copiedLink} onChange={(p) => s.setInviteForm((prev) => ({ ...prev, ...p }))} onClose={() => { s.closeModal(); s.setGeneratedLink?.(null); }} onSubmit={s.handleInviteSubmit} onCopyLink={s.handleCopyLink} />
      <ConfirmModal isOpen={!!s.confirmState} title={s.confirmState?.title} message={s.confirmState?.message} onConfirm={s.handleAction} onClose={() => s.setConfirmState(null)} />
    </div>
  );
};

export default AdminManagement;
