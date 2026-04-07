/** Shared formatting helpers used across pages. */

export const formatTimestamp = (value) => {
  if (!value) return 'No live updates yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

export const formatViolationType = (type) => {
  if (type === 'APPROACHING_BOUNDARY') return 'Approaching Boundary';
  if (type === 'SUSTAINED_BREACH') return 'Sustained Breach';
  return 'Breach';
};
