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
  setUserActive
} = require('../controllers/adminController');

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

module.exports = router;
