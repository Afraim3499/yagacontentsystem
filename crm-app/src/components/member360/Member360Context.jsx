import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

// Lightweight global "which member is open in the 360 panel" state.
// <Member360Panel/> is mounted once in App.jsx and reads this.
//
// openMember(id, { onAfterChange }) — the opener can pass a refetch callback;
// the panel calls it after any in-panel mutation so the underlying desk
// table stays in sync.

const Member360Context = createContext(null);

export function Member360Provider({ children }) {
  const [memberId, setMemberId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const onAfterChangeRef = useRef(null);

  const openMember = useCallback((id, opts = {}) => {
    onAfterChangeRef.current = typeof opts.onAfterChange === 'function' ? opts.onAfterChange : null;
    setMemberId(id || null);
  }, []);
  const close = useCallback(() => setMemberId(null), []);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const notifyChange = useCallback(() => {
    setRefreshKey((k) => k + 1);
    if (onAfterChangeRef.current) onAfterChangeRef.current();
  }, []);

  const value = useMemo(
    () => ({ memberId, openMember, close, refresh, notifyChange, refreshKey }),
    [memberId, openMember, close, refresh, notifyChange, refreshKey],
  );

  return <Member360Context.Provider value={value}>{children}</Member360Context.Provider>;
}

export function useMember360() {
  const ctx = useContext(Member360Context);
  if (!ctx) throw new Error('useMember360 must be used within <Member360Provider>');
  return ctx;
}
