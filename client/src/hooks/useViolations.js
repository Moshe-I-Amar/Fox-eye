import { useState, useCallback, useEffect } from 'react';
import { violationService } from '../services/violationsApi';

/**
 * useViolations — fetch violation history with filter support.
 *
 * @param {boolean} canView       — if false, fetching is skipped entirely
 * @param {object}  filters       — { severity, companyId, start, end }
 * @param {number}  [limit=20]    — max records per request
 *
 * Returns { violations, loading, error }
 */
const useViolations = (canView, filters = {}, limit = 20) => {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetch = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      setError('');
      const params = { limit };
      if (filters.severity && filters.severity !== 'all') params.severity = filters.severity;
      if (filters.companyId) params.companyId = filters.companyId;
      if (filters.start)     params.start = filters.start;
      if (filters.end)       params.end   = filters.end;
      const response = await violationService.getViolations(params);
      setViolations(response.violations || []);
    } catch {
      setError('Failed to load violation history.');
    } finally {
      setLoading(false);
    }
  }, [canView, filters.severity, filters.companyId, filters.start, filters.end, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { violations, loading, error };
};

export default useViolations;
