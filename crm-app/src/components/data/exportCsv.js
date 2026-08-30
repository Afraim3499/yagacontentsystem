// RFC-4180 CSV export.
//
// Replaces the pattern copy-pasted across VipMembersDeskView /
// MemberTrackingDeskView / TradeSignalsDeskView:
//   encodeURI("data:text/csv;charset=utf-8," + rows.join("\n"))
// which breaks on `#` / `%` in the data, has no quote-escaping (a name with
// a comma or a `"` corrupts the file), and hits URL length limits on big
// exports.

function csvCell(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param {Array<object>} rows      the (already filtered/sorted) data
 * @param {Array<{ header: string, csv?: (row)=>any, key?: string }>} columns
 * @param {string} filename         without extension
 */
export function exportCsv(rows, columns, filename) {
  const cols = columns.filter((c) => c.header && (c.csv || c.key));
  const headerLine = cols.map((c) => csvCell(c.header)).join(',');
  const bodyLines = rows.map((row) =>
    cols.map((c) => csvCell(c.csv ? c.csv(row) : row[c.key])).join(','),
  );
  const content = '﻿' + [headerLine, ...bodyLines].join('\r\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
