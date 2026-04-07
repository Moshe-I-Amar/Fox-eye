import { useState, useEffect } from 'react';
import { hierarchyService } from '../../services/hierarchyApi';

const useHierarchyData = () => {
  const [hierarchyMap, setHierarchyMap] = useState({ units: {}, companies: {}, teams: {}, squads: {} });
  const [companyOptions, setCompanyOptions] = useState([]);

  useEffect(() => {
    let active = true;
    hierarchyService.getTree().then((data) => {
      if (!active) return;
      const units = {}, companies = {}, teams = {}, squads = {};
      (data.units || []).forEach((u) => { units[u._id] = u.name; });
      (data.companies || []).forEach((c) => { companies[c._id] = { name: c.name, color: c.color, pattern: c.pattern, icon: c.icon }; });
      (data.teams || []).forEach((t) => { teams[t._id] = t.name; });
      (data.squads || []).forEach((s) => { squads[s._id] = s.name; });
      setHierarchyMap({ units, companies, teams, squads });
      setCompanyOptions(data.companies || []);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  return { hierarchyMap, companyOptions };
};

export default useHierarchyData;
