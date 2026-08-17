import React from 'react';

/**
 * Shared loading-skeleton primitives, styled to match the CRM's dark
 * glass-panel theme. These exist so switching desks (or refreshing one)
 * shows a shape-matched placeholder instead of the whole panel collapsing
 * into a single centered spinner — same information layout stays visible,
 * it's just shimmering until data arrives.
 *
 * Pure presentation — no data-fetching or layout logic lives here, so
 * dropping these in only changes what renders while `loading` is true.
 * The moment `loading` flips to false, the exact same real content/branch
 * that was already there takes over, unchanged.
 */

export function SkeletonBar({ width = '100%', height = '0.75rem', className = '' }) {
  return (
    <div
      className={`bg-white/5 rounded-md animate-pulse ${className}`}
      style={{ width, height }}
    />
  );
}

/** N shimmering <tr> rows matching a given column count — drop straight into an existing <tbody>. */
export function SkeletonTableRows({ columns = 5, rows = 8, cellClassName = 'px-4 py-3.5' }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-white/5">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className={cellClassName}>
              <SkeletonBar width={c === 0 ? '85%' : `${55 + ((r + c) % 4) * 10}%`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** N shimmering card blocks — for list/card layouts (e.g. Content Studio's per-topic rows) instead of a <table>. */
export function SkeletonCardList({ count = 4 }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-6 rounded-2xl bg-[#080a0f] border border-white/10 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <SkeletonBar width="90px" height="1.25rem" />
            <SkeletonBar width="70px" height="1.25rem" />
            <SkeletonBar width="140px" height="1.25rem" />
          </div>
          <SkeletonBar width="60%" height="1rem" />
          <SkeletonBar width="90%" height="0.75rem" />
          <SkeletonBar width="75%" height="0.75rem" />
        </div>
      ))}
    </div>
  );
}

/** N shimmering cards laid out in a responsive grid (e.g. review queue cards). */
export function SkeletonCardGrid({ count = 4, columns = 'md:grid-cols-2' }) {
  return (
    <div className={`grid grid-cols-1 ${columns} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-panel p-6 space-y-4 border border-white/10">
          <SkeletonBar width="50%" height="1rem" />
          <SkeletonBar width="90%" height="0.75rem" />
          <SkeletonBar width="70%" height="0.75rem" />
          <SkeletonBar width="40%" height="0.75rem" />
        </div>
      ))}
    </div>
  );
}

/** Shimmering KPI/stat tile — for dashboard-style summary card grids. */
export function SkeletonStatCard() {
  return (
    <div className="bg-[#0f141d] p-5 rounded-2xl border border-slate-800 shadow-lg space-y-3">
      <SkeletonBar width="60%" height="0.65rem" />
      <SkeletonBar width="45%" height="1.5rem" />
      <SkeletonBar width="75%" height="0.6rem" />
    </div>
  );
}
