import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { SkeletonTableRows } from '../Skeleton';

// ---------------------------------------------------------------------------
// DataTable — the "spacer <tr> + useVirtualizer" windowing block that was
// copy-pasted into VipMembersDeskView / MemberTrackingDeskView /
// AffiliatesDeskView / TradeSignalsDeskView, extracted once.
//
// Real <table>/<thead>/<tbody>/<tr>/<td> markup throughout (absolutely-
// positioned <tr> is unreliable inside native table layout), dynamic row
// measurement, sticky header. Header cells with `sortable` drive multi-sort:
// click = set/flip this key as the sole sort, shift-click = add/flip as a
// secondary key.
//
// columns: [{
//   key, header, width?, align?: 'left'|'right'|'center',
//   sortKey?: string,          // enables the header sort control
//   render: (row) => ReactNode,
//   csv?: (row) => any,        // used by exportCsv, not here
//   headerClassName?, cellClassName?
// }]
// ---------------------------------------------------------------------------

export default function DataTable({
  rows,
  columns,
  sort = [],
  onToggleSort,
  loading = false,
  emptyState = null,
  onRowClick,
  rowKey = (r) => r.id,
  estimateRowHeight = 76,
  maxHeight = '70vh',
}) {
  // Columns without a render fn are export-only (they still appear in the
  // CSV via exportCsv) — don't try to draw them.
  const visibleColumns = columns.filter((c) => typeof c.render === 'function');

  const scrollRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 8,
  });
  const vRows = virtualizer.getVirtualItems();
  const padTop = vRows.length > 0 ? vRows[0].start : 0;
  const padBottom = vRows.length > 0 ? virtualizer.getTotalSize() - vRows[vRows.length - 1].end : 0;

  const sortFor = (key) => sort.find((s) => s.key === key);

  const HeaderCell = (col) => {
    const active = col.sortKey ? sortFor(col.sortKey) : null;
    const idx = col.sortKey ? sort.findIndex((s) => s.key === col.sortKey) : -1;
    return (
      <th
        key={col.key}
        scope="col"
        style={col.width ? { width: col.width } : undefined}
        className={`py-3 px-4 text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wider ${
          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
        } ${col.headerClassName || ''} ${col.sortKey ? 'cursor-pointer select-none hover:text-[var(--color-text)]' : ''}`}
        onClick={col.sortKey ? (e) => onToggleSort?.(col.sortKey, e.shiftKey) : undefined}
      >
        <span className="inline-flex items-center gap-1">
          {col.header}
          {active && (active.dir === 'asc' ? <ArrowUp className="w-3 h-3 text-[var(--color-gold)]" /> : <ArrowDown className="w-3 h-3 text-[var(--color-gold)]" />)}
          {active && sort.length > 1 && <sup className="text-[8px] text-[var(--color-muted)]">{idx + 1}</sup>}
        </span>
      </th>
    );
  };

  return (
    <div className="glass-panel border border-[var(--border-line)] rounded-2xl overflow-hidden">
      {loading ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[var(--bg-input)] border-b border-[var(--border-line)]">
              <tr>{visibleColumns.map(HeaderCell)}</tr>
            </thead>
            <tbody><SkeletonTableRows columns={visibleColumns.length} rows={8} /></tbody>
          </table>
        </div>
      ) : rows.length === 0 ? (
        emptyState || (
          <div className="p-16 text-center text-sm text-[var(--color-muted)]">No rows match the current filters.</div>
        )
      ) : (
        <div ref={scrollRef} className="overflow-auto" style={{ maxHeight }}>
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-[var(--bg-input)] border-b border-[var(--border-line)]">
              <tr>{visibleColumns.map(HeaderCell)}</tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-line)] text-sm">
              {padTop > 0 && (
                <tr aria-hidden="true" style={{ height: padTop }}>
                  <td colSpan={visibleColumns.length} style={{ padding: 0, border: 'none' }} />
                </tr>
              )}
              {vRows.map((vRow) => {
                const row = rows[vRow.index];
                return (
                  <tr
                    key={rowKey(row)}
                    data-index={vRow.index}
                    ref={virtualizer.measureElement}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`hover:bg-[var(--bg-surface-hover)] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`py-3 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.cellClassName || ''}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {padBottom > 0 && (
                <tr aria-hidden="true" style={{ height: padBottom }}>
                  <td colSpan={visibleColumns.length} style={{ padding: 0, border: 'none' }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
