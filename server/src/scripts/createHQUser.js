require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Unit = require('../models/Unit');
const Company = require('../models/Company');
const Team = require('../models/Team');
const Squad = require('../models/Squad');
const User = require('../models/User');

const EMAIL = 'hq@foxeye.com';
const PASSWORD = 'HQAdmin@2026';

const run = async () => {
  try {
    await connectDB();

    const unit = await Unit.findOne().lean();
    if (!unit) throw new Error('No units found. Run the seed script first.');

    const company = await Company.findOne({ parentId: unit._id }).lean();
    if (!company) throw new Error('No companies found under unit.');

    const team = await Team.findOne({ parentId: company._id }).lean();
    if (!team) throw new Error('No teams found under company.');

    const squad = await Squad.findOne({ parentId: team._id }).lean();
    if (!squad) throw new Error('No squads found under team.');

    const existing = await User.findOne({ email: EMAIL }).lean();
    if (existing) {
      console.log(`User already exists: ${EMAIL}`);
      return;
    }

    await User.create({
      name: 'HQ Commander',
      email: EMAIL,
      password: PASSWORD,
      role: 'admin',
      operationalRole: 'HQ',
      unitId: unit._id,
      companyId: company._id,
      teamId: team._id,
      squadId: squad._id,
      active: true
    });

    console.log('HQ user created successfully.');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
