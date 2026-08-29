'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUiStore } from '@/stores/ui-store';

/**
 * Bottom-left transient notice (per docs/02 F-101). Reads `toast` from the UI
 * store and auto-dismisses after 5 seconds. The 5-second debounce that
 * prevents more than one toast per 5s lives in the page-level wiring
 * (page.tsx), not here — this component just renders whatever is in the
 * store and cleans up when it changes.
 */
export function Toast() {
  const toast = useUiStore((s) => s.toast);
  const dismissToast = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(dismissToast, 5000);
    return () => clearTimeout(id);
  }, [toast, dismissToast]);

  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 z-30 max-w-[260px] rounded-lg border border-accent-cyan/40 bg-bg-elev/95 backdrop-blur px-3 py-2 text-xs text-text-primary shadow-panel-elev"
          role="status"
        >
          {toast.message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default Toast;
