const Unit = require('../models/Unit');
const Company = require('../models/Company');
const Team = require('../models/Team');
const Squad = require('../models/Squad');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

const listHierarchyTree = asyncHandler(async (req, res) => {
  const [units, companies, teams, squads] = await Promise.all([
    Unit.find({ active: true }).sort({ name: 1 }).lean(),
    Company.find({ active: true }).sort({ name: 1 }).lean(),
    Team.find({ active: true }).sort({ name: 1 }).lean(),
    Squad.find({ active: true }).sort({ name: 1 }).lean()
  ]);

  res.json({
    success: true,
    data: {
      units,
      companies,
      teams,
      squads
    }
  });
});

const listUnits = asyncHandler(async (req, res) => {
  const units = await Unit.find({ active: true }).sort({ name: 1 }).lean();
  res.json({ success: true, data: { units } });
});

const listCompanies = asyncHandler(async (req, res) => {
  const { unitId } = req.query;
  if (!unitId) {
    throw new AppError('VALIDATION_ERROR', 'unitId is required', 400);
  }
  const companies = await Company.find({ parentId: unitId, active: true }).sort({ name: 1 }).lean();
  res.json({ success: true, data: { companies } });
});

const listTeams = asyncHandler(async (req, res) => {
  const { companyId } = req.query;
  if (!companyId) {
    throw new AppError('VALIDATION_ERROR', 'companyId is required', 400);
  }
  const teams = await Team.find({ parentId: companyId, active: true }).sort({ name: 1 }).lean();
  res.json({ success: true, data: { teams } });
});

const listSquads = asyncHandler(async (req, res) => {
  const { teamId } = req.query;
  if (!teamId) {
    throw new AppError('VALIDATION_ERROR', 'teamId is required', 400);
  }
  const squads = await Squad.find({ parentId: teamId, active: true }).sort({ name: 1 }).lean();
  res.json({ success: true, data: { squads } });
});

module.exports = {
  listHierarchyTree,
  listUnits,
  listCompanies,
  listTeams,
  listSquads
};
