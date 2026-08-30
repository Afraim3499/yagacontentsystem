import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startOfDayISO, endOfDayISO } from './dates';

// ---------------------------------------------------------------------------
// useTableControls — one hook for search + filters + date ranges + multi-sort,
// applied client-side over an already-loaded row array, with the whole control
// state mirrored into the URL query string so a filtered view is shareable and
// survives reload.
//
// Config shape:
//   {
//     urlKey: 'vip',
//     searchKeys: ['first_name', ...],
//     filters: [
//       { key, type: 'select'|'multiselect'|'numberrange'|'daterange',
//         accessor?: (row) => value,
//         options?: [{ value, label }] }
//     ],
//     sortAccessors: { joined_at: (row) => ... },
//     defaultSort: [{ key: 'joined_at', dir: 'desc' }],
//   }
// ---------------------------------------------------------------------------

function readUrl(urlKey) {
  if (typeof window === 'undefined') return {};
  const sp = new URLSearchParams(window.location.search);
  const out = {};
  for (const [k, v] of sp.entries()) {
    if (k.startsWith(`${urlKey}.`)) out[k.slice(urlKey.length + 1)] = v;
  }
  return out;
}

function writeUrl(urlKey, flat) {
  if (typeof window === 'undefined') return;
  const sp = new URLSearchParams(window.location.search);
  for (const k of [...sp.keys()]) {
    if (k.startsWith(`${urlKey}.`)) sp.delete(k);
  }
  for (const [k, v] of Object.entries(flat)) {
    if (v !== '' && v != null) sp.set(`${urlKey}.${k}`, v);
  }
  const qs = sp.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', next);
}

function parseSortParam(str) {
  if (!str) return null;
  return str
    .split(',')
    .filter(Boolean)
    .map((seg) => (seg.startsWith('-') ? { key: seg.slice(1), dir: 'desc' } : { key: seg, dir: 'asc' }));
}

function serialiseSort(sort) {
  return sort.map((s) => (s.dir === 'desc' ? `-${s.key}` : s.key)).join(',');
}

// One filter clause -> does this row pass it?
function rowPassesFilter(row, f, v) {
  const get = f.accessor || ((r) => r[f.key]);
  if (f.type === 'select') {
    return !v || v === 'ALL' || String(get(row)) === String(v);
  }
  if (f.type === 'multiselect') {
    return !v?.length || v.map(String).includes(String(get(row)));
  }
  if (f.type === 'numberrange') {
    const n = Number(get(row));
    if (v?.min !== '' && v?.min != null && !(n >= Number(v.min))) return false;
    if (v?.max !== '' && v?.max != null && !(n <= Number(v.max))) return false;
    return true;
  }
  if (f.type === 'daterange') {
    const raw = get(row);
    const t = raw ? new Date(raw).getTime() : NaN;
    if (v?.from && !(t >= new Date(startOfDayISO(v.from)).getTime())) return false;
    if (v?.to && !(t <= new Date(endOfDayISO(v.to)).getTime())) return false;
    return true;
  }
  return true;
}

export function useTableControls(config) {
  const {
    urlKey,
    searchKeys = [],
    filters = [],
    sortAccessors = {},
    defaultSort = [],
  } = config;

  const initial = useRef(readUrl(urlKey)).current;

  const [search, setSearch] = useState(initial.q || '');
  const [filterValues, setFilterValues] = useState(() => {
    const fv = {};
    for (const f of filters) {
      if (f.type === 'daterange') fv[f.key] = { from: initial[`${f.key}_from`] || '', to: initial[`${f.key}_to`] || '' };
      else if (f.type === 'numberrange') fv[f.key] = { min: initial[`${f.key}_min`] || '', max: initial[`${f.key}_max`] || '' };
      else if (f.type === 'multiselect') fv[f.key] = initial[f.key] ? initial[f.key].split('~').filter(Boolean) : [];
      else fv[f.key] = initial[f.key] || 'ALL';
    }
    return fv;
  });
  const [sort, setSort] = useState(() => parseSortParam(initial.sort) || defaultSort);

  // mirror state -> URL
  useEffect(() => {
    const flat = {};
    if (search) flat.q = search;
    for (const f of filters) {
      const v = filterValues[f.key];
      if (f.type === 'daterange') {
        if (v?.from) flat[`${f.key}_from`] = v.from;
        if (v?.to) flat[`${f.key}_to`] = v.to;
      } else if (f.type === 'numberrange') {
        if (v?.min !== '' && v?.min != null) flat[`${f.key}_min`] = v.min;
        if (v?.max !== '' && v?.max != null) flat[`${f.key}_max`] = v.max;
      } else if (f.type === 'multiselect') {
        if (v?.length) flat[f.key] = v.join('~');
      } else if (v && v !== 'ALL') {
        flat[f.key] = v;
      }
    }
    const sortStr = serialiseSort(sort);
    const defStr = serialiseSort(defaultSort);
    if (sortStr && sortStr !== defStr) flat.sort = sortStr;
    writeUrl(urlKey, flat);
  }, [search, filterValues, sort, urlKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilterValue = useCallback((key, value) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSort = useCallback((key, additive = false) => {
    setSort((prev) => {
      const existing = prev.find((s) => s.key === key);
      if (additive) {
        if (!existing) return [...prev, { key, dir: 'asc' }];
        if (existing.dir === 'asc') return prev.map((s) => (s.key === key ? { ...s, dir: 'desc' } : s));
        return prev.filter((s) => s.key !== key);
      }
      if (!existing) return [{ key, dir: 'desc' }];
      if (existing.dir === 'desc') return [{ key, dir: 'asc' }];
      return defaultSort.length ? defaultSort : [{ key, dir: 'desc' }];
    });
  }, [defaultSort]);

  const emptyFilterValues = useCallback(() => {
    const fv = {};
    for (const f of filters) {
      if (f.type === 'daterange') fv[f.key] = { from: '', to: '' };
      else if (f.type === 'numberrange') fv[f.key] = { min: '', max: '' };
      else if (f.type === 'multiselect') fv[f.key] = [];
      else fv[f.key] = 'ALL';
    }
    return fv;
  }, [filters]);

  const resetAll = useCallback(() => {
    setSearch('');
    setFilterValues(emptyFilterValues());
    setSort(defaultSort);
  }, [emptyFilterValues, defaultSort]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (search) n++;
    for (const f of filters) {
      const v = filterValues[f.key];
      if (f.type === 'daterange') n += (v?.from ? 1 : 0) + (v?.to ? 1 : 0);
      else if (f.type === 'numberrange') n += (v?.min !== '' && v?.min != null ? 1 : 0) + (v?.max !== '' && v?.max != null ? 1 : 0);
      else if (f.type === 'multiselect') n += v?.length ? 1 : 0;
      else if (v && v !== 'ALL') n++;
    }
    return n;
  }, [search, filterValues, filters]);

  const matchesSearch = useCallback((row) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return searchKeys.some((k) => {
      const val = row[k];
      return val != null && String(val).toLowerCase().includes(s);
    });
  }, [search, searchKeys]);

  const apply = useCallback((rows) => {
    let out = rows.filter((row) => {
      if (!matchesSearch(row)) return false;
      for (const f of filters) {
        if (!rowPassesFilter(row, f, filterValues[f.key])) return false;
      }
      return true;
    });

    if (sort.length) {
      out = [...out].sort((a, b) => {
        for (const s of sort) {
          const acc = sortAccessors[s.key];
          if (!acc) continue;
          let av = acc(a); let bv = acc(b);
          if (av == null) av = -Infinity;
          if (bv == null) bv = -Infinity;
          if (av < bv) return s.dir === 'asc' ? -1 : 1;
          if (av > bv) return s.dir === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return out;
  }, [matchesSearch, filterValues, sort, filters, sortAccessors]);

  // Faceted counts: for each select/multiselect filter, how many rows fall
  // under each option once search + every OTHER filter is applied. This is
  // what powers the "(n)" badges next to each filter option.
  const facetCounts = useCallback((rows) => {
    const result = {};
    for (const f of filters) {
      if (f.type !== 'select' && f.type !== 'multiselect') continue;
      const get = f.accessor || ((r) => r[f.key]);
      const subset = rows.filter((row) => {
        if (!matchesSearch(row)) return false;
        for (const other of filters) {
          if (other.key === f.key) continue;
          if (!rowPassesFilter(row, other, filterValues[other.key])) return false;
        }
        return true;
      });
      const counts = { __total: subset.length };
      for (const row of subset) {
        const v = String(get(row) ?? '');
        counts[v] = (counts[v] || 0) + 1;
      }
      result[f.key] = counts;
    }
    return result;
  }, [filters, filterValues, matchesSearch]);

  return {
    search, setSearch,
    filterValues, setFilterValue,
    sort, toggleSort,
    resetAll, activeCount,
    apply, facetCounts,
  };
}
