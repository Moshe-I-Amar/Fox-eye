require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Unit = require('../models/Unit');
const Company = require('../models/Company');
const Team = require('../models/Team');
const Squad = require('../models/Squad');
const User = require('../models/User');

const DEMO_PASSWORD = 'password123';

const buildTeams = (companies) => {
  const teams = [];
  companies.forEach((company, companyIndex) => {
    for (let i = 1; i <= 2; i += 1) {
      const label = companyIndex === 0 ? 'Alpha' : 'Bravo';
      teams.push({
        name: `${label}-${i} Team`,
        parentId: company._id
      });
    }
  });
  return teams;
};

const buildSquads = (teams) => {
  const squads = [];
  teams.forEach((team) => {
    for (let i = 1; i <= 2; i += 1) {
      squads.push({
        name: `${team.name.replace(' Team', '')}-${i} Squad`,
        parentId: team._id
      });
    }
  });
  return squads;
};

const mapByParent = (items) => {
  return items.reduce((acc, item) => {
    const key = item.parentId.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
};

const createUser = async (payload) => {
  const user = new User(payload);
  await user.save();
  return user;
};

const seedDemoHierarchy = async () => {
  try {
    await connectDB();

    await Promise.all([
      User.deleteMany({}),
      Squad.deleteMany({}),
      Team.deleteMany({}),
      Company.deleteMany({}),
      Unit.deleteMany({})
    ]);

    const unit = await Unit.create({
      name: 'Falcon Unit'
    });

    const companies = await Company.insertMany([
      { name: 'Alpha Company', parentId: unit._id },
      { name: 'Bravo Company', parentId: unit._id }
    ]);

    const teams = await Team.insertMany(buildTeams(companies));
    const squads = await Squad.insertMany(buildSquads(teams));

    const teamsByCompany = mapByParent(teams);
    const squadsByTeam = mapByParent(squads);

    const primaryCompany = companies[0];
    const primaryTeam = teamsByCompany[primaryCompany._id.toString()][0];
    const primarySquad = squadsByTeam[primaryTeam._id.toString()][0];

    const unitCommander = await createUser({
      name: 'Unit Commander',
      email: 'unit.commander@demo.com',
      password: DEMO_PASSWORD,
      role: 'admin',
      unitId: unit._id,
      companyId: primaryCompany._id,
      teamId: primaryTeam._id,
      squadId: primarySquad._id
    });

    const companyCommanders = [];
    for (const company of companies) {
      const [team] = teamsByCompany[company._id.toString()];
      const [squad] = squadsByTeam[team._id.toString()];
      companyCommanders.push(await createUser({
        name: `${company.name} Commander`,
        email: `${company.name.split(' ')[0].toLowerCase()}.company.commander@demo.com`,
        password: DEMO_PASSWORD,
        role: 'user',
        unitId: unit._id,
        companyId: company._id,
        teamId: team._id,
        squadId: squad._id
      }));
    }

    const teamCommanders = [];
    for (const team of teams) {
      const [squad] = squadsByTeam[team._id.toString()];
      teamCommanders.push(await createUser({
        name: `${team.name} Commander`,
        email: `${team.name.replace(' ', '.').replace(' Team', '').toLowerCase()}.team.commander@demo.com`,
        password: DEMO_PASSWORD,
        role: 'user',
        unitId: unit._id,
        companyId: team.parentId,
        teamId: team._id,
        squadId: squad._id
      }));
    }

    const squadCommanders = [];
    for (const squad of squads) {
      squadCommanders.push(await createUser({
        name: `${squad.name} Commander`,
        email: `${squad.name.replace(' ', '.').replace(' Squad', '').toLowerCase()}.squad.commander@demo.com`,
        password: DEMO_PASSWORD,
        role: 'user',
        unitId: unit._id,
        companyId: teams.find((team) => team._id.equals(squad.parentId)).parentId,
        teamId: squad.parentId,
        squadId: squad._id
      }));
    }

    await Unit.updateOne({ _id: unit._id }, { commanderId: unitCommander._id });
    await Company.bulkWrite(companyCommanders.map((commander, index) => ({
      updateOne: {
        filter: { _id: companies[index]._id },
        update: { commanderId: commander._id }
      }
    })));

    await Team.bulkWrite(teamCommanders.map((commander, index) => ({
      updateOne: {
        filter: { _id: teams[index]._id },
        update: { commanderId: commander._id }
      }
    })));

    await Squad.bulkWrite(squadCommanders.map((commander, index) => ({
      updateOne: {
        filter: { _id: squads[index]._id },
        update: { commanderId: commander._id }
      }
    })));

    console.log('Seeded demo hierarchy data successfully.');
  } catch (error) {
    console.error('Failed to seed demo hierarchy data:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedDemoHierarchy();
