import React, { useState, useMemo } from 'react';
import Button from './Button';

/**
 * Table — reusable dark-themed table with optional sorting and pagination.
 *
 * columns: Array<{ key: string, label: string, sortable?: boolean, render?: (value, row) => ReactNode, className?: string }>
 * data:    Array<object>
 * keyField: string — field used as React key (default '_id')
 * pageSize: number — rows per page; 0 = no pagination
 * emptyMessage: string
 * loading: boolean
 */
const Table = ({
  columns = [],
  data = [],
  keyField = '_id',
  pageSize = 10,
  emptyMessage = 'No data found',
  loading = false,
  className = '',
}) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = pageSize > 0 ? Math.ceil(sorted.length / pageSize) : 1;
  const paged = pageSize > 0 ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gold/20">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left py-3 px-4 text-gold font-medium text-sm ${col.sortable ? 'cursor-pointer select-none hover:text-gold-light' : ''} ${col.className ?? ''}`}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {sortDir === 'asc'
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />}
                    </svg>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={columns.length} className="py-2 px-4">
                  <div className="loading-skeleton rounded h-10" />
                </td>
              </tr>
            ))
          ) : paged.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-12 text-gold/40">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            paged.map((row) => (
              <tr key={row[keyField]} className="border-b border-gold/10 hover:bg-gold/5 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`py-3 px-4 ${col.className ?? ''}`}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {pageSize > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gold/20">
          <span className="text-gold/50 text-sm">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              Previous
            </Button>
            <span className="text-gold text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;
