import React, { useEffect, useRef, useState } from 'react';
import { Search, X, RotateCcw, Check, Star } from 'lucide-react';

// ---------------------------------------------------------------------------
// FilterBar — search box + one control per filter, a Reset button, a saved-
// presets menu (localStorage, keyed by config.urlKey), and — the important
// part — a clearly shown count of how many rows fall under every option and
// under the current filter set as a whole.
//
// Props:
//   config    — the useTableControls config
//   controls  — the useTableControls return value
//   associates — optional [{id,name}] to populate an 'optionsFrom: associates' filter
//   facets    — controls.facetCounts(sourceRows): per-option row counts
//   matched   — number of rows matching the current filters
//   total     — total rows before filtering
// ---------------------------------------------------------------------------

const inputCls =
  'bg-[var(--bg-input)] border border-[var(--border-line)] text-[var(--color-text)] text-xs ' +
  'rounded-xl px-3 py-2 focus:outline-none focus:border-[var(--color-gold)] transition-colors';

const countCls = 'text-[var(--color-muted)] font-mono';

function MultiSelect({ label, options, value, onChange, counts }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const selectedTotal = value.reduce((s, v) => s + (counts?.[v] || 0), 0);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center gap-1.5 cursor-pointer ${value.length ? 'border-[var(--color-gold)]' : ''}`}
      >
        {label}
        {value.length
          ? <span className={countCls}>· {value.length} sel · {selectedTotal}</span>
          : <span className={countCls}>· {counts?.__total ?? 0}</span>}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 min-w-[240px] max-h-72 overflow-auto bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-xl shadow-2xl p-1">
          {options.map((o) => {
            const c = counts?.[String(o.value)] ?? 0;
            const on = value.includes(String(o.value));
            return (
              <button
                type="button"
                key={o.value}
                onClick={() => toggle(String(o.value))}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--bg-surface-hover)] rounded-lg text-left"
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-[var(--color-gold)] border-[var(--color-gold)]' : 'border-[var(--border-line)]'}`}>
                  {on && <Check className="w-2.5 h-2.5 text-black" strokeWidth={4} />}
                </span>
                <span className="flex-1 truncate">{o.label}</span>
                <span className={`${countCls} ${c === 0 ? 'opacity-40' : ''}`}>{c}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function loadPresets(key) {
  try { return JSON.parse(localStorage.getItem(`crm_presets_${key}`) || '[]'); } catch { return []; }
}
function savePresets(key, list) {
  try { localStorage.setItem(`crm_presets_${key}`, JSON.stringify(list)); } catch { /* ignore */ }
}

export default function FilterBar({ config, controls, associates, facets = {}, matched, total }) {
  const { search, setSearch, filterValues, setFilterValue, resetAll, activeCount } = controls;
  const [presets, setPresets] = useState(() => loadPresets(config.urlKey));
  const [presetOpen, setPresetOpen] = useState(false);
  const presetRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (presetRef.current && !presetRef.current.contains(e.target)) setPresetOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const applyPreset = (p) => {
    setSearch(p.state.search || '');
    for (const [k, v] of Object.entries(p.state.filterValues || {})) setFilterValue(k, v);
  };
  const addPreset = () => {
    const name = window.prompt('Name this filter preset:');
    if (!name) return;
    const next = [...presets.filter((p) => p.name !== name), { name, state: { search, filterValues } }];
    setPresets(next); savePresets(config.urlKey, next);
  };
  const removePreset = (name) => {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next); savePresets(config.urlKey, next);
  };

  const optionsFor = (f) => {
    if (f.optionsFrom === 'associates') {
      return [
        ...(associates || []).map((a) => ({ value: a.id, label: a.name })),
        { value: 'DIRECT', label: 'Unattributed / Direct' },
      ];
    }
    return f.options || [];
  };

  return (
    <div className="glass-panel p-4 space-y-3 border border-[var(--border-line)]">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={config.searchPlaceholder || 'Search…'}
            className={`${inputCls} w-full pl-9 pr-8`}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {config.filters.map((f) => {
          const v = filterValues[f.key];
          const fc = facets[f.key] || {};
          if (f.type === 'select') {
            return (
              <select key={f.key} value={v} onChange={(e) => setFilterValue(f.key, e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="ALL">{f.label} ({fc.__total ?? 0})</option>
                {optionsFor(f).map((o) => (
                  <option key={o.value} value={o.value}>{o.label} ({fc[String(o.value)] ?? 0})</option>
                ))}
              </select>
            );
          }
          if (f.type === 'multiselect') {
            return <MultiSelect key={f.key} label={f.label} options={optionsFor(f)} value={v || []} counts={fc} onChange={(nv) => setFilterValue(f.key, nv)} />;
          }
          if (f.type === 'numberrange') {
            return (
              <div key={f.key} className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide">{f.label}</span>
                <input type="number" value={v?.min ?? ''} onChange={(e) => setFilterValue(f.key, { ...v, min: e.target.value })} placeholder="min" className={`${inputCls} w-20`} />
                <input type="number" value={v?.max ?? ''} onChange={(e) => setFilterValue(f.key, { ...v, max: e.target.value })} placeholder="max" className={`${inputCls} w-20`} />
              </div>
            );
          }
          if (f.type === 'daterange') {
            return (
              <div key={f.key} className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide">{f.label}</span>
                <input type="date" value={v?.from ?? ''} onChange={(e) => setFilterValue(f.key, { ...v, from: e.target.value })} className={inputCls} />
                <span className="text-[var(--color-muted)] text-xs">→</span>
                <input type="date" value={v?.to ?? ''} onChange={(e) => setFilterValue(f.key, { ...v, to: e.target.value })} className={inputCls} />
              </div>
            );
          }
          return null;
        })}

        {/* presets */}
        <div className="relative" ref={presetRef}>
          <button type="button" onClick={() => setPresetOpen((o) => !o)} className={`${inputCls} flex items-center gap-1.5 cursor-pointer`} title="Saved filter presets">
            <Star className="w-3.5 h-3.5" /> Views
          </button>
          {presetOpen && (
            <div className="absolute right-0 z-30 mt-1 min-w-[220px] bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-xl shadow-2xl p-1">
              {presets.length === 0 && <div className="px-2.5 py-2 text-xs text-[var(--color-muted)]">No saved views yet</div>}
              {presets.map((p) => (
                <div key={p.name} className="flex items-center group">
                  <button type="button" onClick={() => { applyPreset(p); setPresetOpen(false); }} className="flex-1 px-2.5 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--bg-surface-hover)] rounded-lg text-left">
                    {p.name}
                  </button>
                  <button type="button" onClick={() => removePreset(p.name)} className="px-2 text-[var(--color-muted)] hover:text-rose-400">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addPreset} className="w-full mt-1 px-2.5 py-1.5 text-xs text-[var(--color-gold)] hover:bg-[var(--bg-surface-hover)] rounded-lg text-left border-t border-[var(--border-line)]">
                + Save current filters
              </button>
            </div>
          )}
        </div>

        {activeCount > 0 && (
          <button onClick={resetAll} className={`${inputCls} flex items-center gap-1.5 cursor-pointer text-[var(--color-gold)]`}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset ({activeCount})
          </button>
        )}
      </div>

      {/* Clearly-shown match count for the whole filter set */}
      {matched != null && (
        <div className="text-xs text-[var(--color-muted)] border-t border-[var(--border-line)] pt-2.5">
          <span className="text-[var(--color-text)] font-bold text-sm">{matched.toLocaleString()}</span>
          {total != null && <span> of {total.toLocaleString()}</span>} match
          {activeCount > 0 ? ` · ${activeCount} filter${activeCount > 1 ? 's' : ''} active` : ' · no filters'}
        </div>
      )}
    </div>
  );
}
