import React from 'react';

/**
 * Shared pagination bar + the client-side slicing logic behind it.
 *
 * A handful of desks used to render every row of a filtered array straight
 * into the DOM with no cap — fine at dozens of rows, but a real perf/UX
 * problem once a table (affiliates, trade signals, VIP members, activity
 * logs) grows into the hundreds or thousands. This gives every desk the
 * same bounded-page behavior already proven out in the Member Tracking
 * desk, instead of full virtualization (a bigger, riskier change to make
 * without being able to visually verify each desk's custom row layout).
 */
export function usePagination(items, defaultPageSize = 100) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(defaultPageSize);

  // Reset to page 1 whenever the underlying filtered set changes size/order.
  React.useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  const totalPages = Math.ceil(items.length / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);

  const pageItems = React.useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, safePage, itemsPerPage]);

  return {
    currentPage: safePage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    pageItems,
  };
}

export default function Pagination({
  currentPage,
  setCurrentPage,
  totalPages,
  itemsPerPage,
  setItemsPerPage,
  totalCount,
  itemLabel = 'items',
  pageSizeOptions = [100, 250, 500],
}) {
  if (totalCount === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#080a0f] p-4 rounded-2xl border border-white/10 text-xs">
      <div className="text-slate-400 font-mono">
        Showing <span className="text-white font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
        <span className="text-white font-bold">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of{' '}
        <span className="text-[#e39e2e] font-bold">{totalCount}</span> {itemLabel}
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        <button
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          className="px-2.5 py-1.5 rounded-lg bg-[#121722] hover:bg-[#1a2130] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[11px] border border-white/10"
          title="First Page"
        >
          « First
        </button>
        <button
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-lg bg-[#121722] hover:bg-[#1a2130] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[11px] border border-white/10"
        >
          ‹ Prev
        </button>

        <div className="flex items-center gap-1 mx-2">
          <span className="text-slate-400 font-mono">Page</span>
          <select
            value={currentPage}
            onChange={(e) => setCurrentPage(Number(e.target.value))}
            className="bg-[#121722] text-[#e39e2e] font-bold font-mono px-2 py-1 rounded-lg border border-[#e39e2e]/40 focus:outline-none cursor-pointer"
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <span className="text-slate-400 font-mono">of {totalPages}</span>
        </div>

        <button
          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-lg bg-[#121722] hover:bg-[#1a2130] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[11px] border border-white/10"
        >
          Next ›
        </button>
        <button
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2.5 py-1.5 rounded-lg bg-[#121722] hover:bg-[#1a2130] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[11px] border border-white/10"
          title="Last Page"
        >
          Last »
        </button>

        <select
          value={itemsPerPage}
          onChange={(e) => setItemsPerPage(Number(e.target.value))}
          className="ml-3 bg-[#121722] text-slate-300 font-mono text-[11px] px-2 py-1.5 rounded-lg border border-white/10 cursor-pointer"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>{size} per page</option>
          ))}
        </select>
      </div>
    </div>
  );
}
