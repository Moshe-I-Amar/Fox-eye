import React from 'react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

const StatusPill = ({ active }) => <Badge variant={active ? 'green' : 'red'} size="sm">{active ? 'Active' : 'Inactive'}</Badge>;

const HierarchyTree = ({ hierarchy, hierarchyLoading, companiesByUnit, teamsByCompany, squadsByTeam }) => (
  <Card glass className="h-full">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-xl font-semibold text-gold">Hierarchy</h2>
        <p className="text-xs text-gold/50">Unit {'>'} Company {'>'} Team {'>'} Squad</p>
      </div>
    </div>
    {hierarchyLoading ? (
      <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="loading-skeleton h-6 rounded-lg" />)}</div>
    ) : (
      <div className="space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin pr-2">
        {hierarchy.units.length === 0 && <div className="text-sm text-gold/60">No units found.</div>}
        {hierarchy.units.map((unit) => (
          <div key={unit._id}>
            <div className="flex items-center justify-between"><div className="text-gold font-semibold">{unit.name}</div><StatusPill active={unit.active !== false} /></div>
            <div className="ml-3 mt-2 space-y-3 border-l border-gold/20 pl-3">
              {(companiesByUnit.get(unit._id) || []).map((company) => (
                <div key={company._id}>
                  <div className="flex items-center justify-between text-sm text-gold/80"><span>{company.name}</span><StatusPill active={company.active !== false} /></div>
                  <div className="ml-3 mt-2 space-y-2 border-l border-gold/10 pl-3">
                    {(teamsByCompany.get(company._id) || []).map((team) => (
                      <div key={team._id}>
                        <div className="flex items-center justify-between text-xs text-gold/70"><span>{team.name}</span><StatusPill active={team.active !== false} /></div>
                        <div className="ml-3 mt-2 space-y-1 border-l border-gold/5 pl-3">
                          {(squadsByTeam.get(team._id) || []).map((squad) => (
                            <div key={squad._id} className="flex items-center justify-between text-[11px] text-gold/60"><span>{squad.name}</span><StatusPill active={squad.active !== false} /></div>
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
);

export default HierarchyTree;
