const OPERATIONAL_ROLES = [
  'SQUAD_COMMANDER',
  'TEAM_COMMANDER',
  'COMPANY_COMMANDER',
  'UNIT_COMMANDER',
  'HQ'
];

const ADMIN_OPERATIONAL_ROLES = ['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER'];

const isOperationalRole = (value) => OPERATIONAL_ROLES.includes(value);

module.exports = {
  OPERATIONAL_ROLES,
  ADMIN_OPERATIONAL_ROLES,
  isOperationalRole
};
