import { useState, useCallback } from 'react';
import { aoService } from '../services/aoApi';

/**
 * useAOs — fetch and manage the AO list.
 *
 * Returns { aos, loading, error, refetch, setAos }
 * Call refetch() after any mutation to sync.
 */
const useAOs = () => {
  const [aos, setAos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await aoService.getAOs();
      setAos(response?.aos || []);
    } catch {
      setError('Failed to load area overlays. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { aos, setAos, loading, error, setError, refetch };
};

export default useAOs;
