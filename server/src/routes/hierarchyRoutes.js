const express = require('express');
const router = express.Router();
const {
  listHierarchyTree,
  listUnits,
  listCompanies,
  listTeams,
  listSquads
} = require('../controllers/hierarchyController');

router.get('/tree', listHierarchyTree);
router.get('/units', listUnits);
router.get('/companies', listCompanies);
router.get('/teams', listTeams);
router.get('/squads', listSquads);

module.exports = router;
