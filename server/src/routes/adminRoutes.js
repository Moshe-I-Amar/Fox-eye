const express = require('express');
const router = express.Router();
const { auth, requireRole, requireOperationalRole } = require('../middleware/auth');
const {
  listAdminHierarchyTree,
  createCompany,
  updateCompany,
  deleteCompany,
  createTeam,
  updateTeam,
  deleteTeam,
  createSquad,
  updateSquad,
  deleteSquad,
  createUser,
  updateUser,
  setUserActive,
  patchUserRoles
} = require('../controllers/adminController');
const {
  createInvite,
  listInvites,
  revokeInvite
} = require('../controllers/inviteController');
const { validateCreateInvite } = require('../utils/validators');

router.use(auth, requireRole(['admin']));

router.get('/hierarchy/tree', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), listAdminHierarchyTree);

router.post('/companies', requireOperationalRole(['HQ', 'UNIT_COMMANDER']), createCompany);
router.put('/companies/:id', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), updateCompany);
router.delete('/companies/:id', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), deleteCompany);

router.post('/teams', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), createTeam);
router.put('/teams/:id', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), updateTeam);
router.delete('/teams/:id', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), deleteTeam);

router.post('/squads', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), createSquad);
router.put('/squads/:id', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), updateSquad);
router.delete('/squads/:id', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), deleteSquad);

router.post('/users', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), createUser);
router.put('/users/:id', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), updateUser);
router.patch('/users/:id/active', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), setUserActive);
router.patch('/users/:id/roles', requireOperationalRole(['HQ', 'UNIT_COMMANDER']), patchUserRoles);

router.post('/invites', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), validateCreateInvite, createInvite);
router.get('/invites', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), listInvites);
router.delete('/invites/:id', requireOperationalRole(['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER']), revokeInvite);

module.exports = router;
