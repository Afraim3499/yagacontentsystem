import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmContext = createContext(null);

/**
 * App-wide replacement for window.confirm(). Renders one styled modal
 * instance (matching the app's existing dark glass-panel modal pattern)
 * and exposes an async confirm(message) function via context, so any desk
 * can do:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm("Delete this?"))) return;
 *
 * instead of the jarring, unstyled native browser dialog.
 */
export function ConfirmDialogProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    message: '',
    title: 'Confirm Action',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    danger: true,
  });
  const resolverRef = useRef(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        open: true,
        message,
        title: options.title || 'Confirm Action',
        confirmLabel: options.confirmLabel || 'Delete',
        cancelLabel: options.cancelLabel || 'Cancel',
        danger: options.danger !== false,
      });
    });
  }, []);

  const handleClose = (result) => {
    setState((prev) => ({ ...prev, open: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {state.open && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => handleClose(false)}
        >
          <div
            className="glass-panel max-w-sm w-full p-6 space-y-5 border border-rose-500/40 bg-[#0f141d]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                state.danger ? 'bg-rose-500/10 text-rose-400' : 'bg-[#e39e2e]/10 text-[#e39e2e]'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">{state.title}</h3>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">{state.message}</p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="px-4 py-2 rounded-xl bg-[#121722] text-slate-300 font-bold text-xs cursor-pointer hover:bg-[#1a2130]"
              >
                {state.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => handleClose(true)}
                className={`px-4 py-2 rounded-xl font-black text-xs cursor-pointer shadow-lg ${
                  state.danger
                    ? 'bg-rose-500 hover:bg-rose-400 text-white'
                    : 'grad-button'
                }`}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/** Returns an async confirm(message, options?) function — see ConfirmDialogProvider. */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm() must be used within a <ConfirmDialogProvider>');
  }
  return confirm;
}
