'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { useUiStore } from '@/stores/ui-store';
import { IconChevronRight } from './icons';

export function Legend() {
  const collapsed = useUiStore((s) => s.legendCollapsed);
  const toggleLegend = useUiStore((s) => s.toggleLegend);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 768 && !useUiStore.getState().legendCollapsed) {
      useUiStore.getState().toggleLegend();
    }
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-30 max-w-[280px]">
      <AnimatePresence initial={false} mode="wait">
        {collapsed ? (
          <motion.button
            key="legend-collapsed"
            type="button"
            onClick={toggleLegend}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border border-bg-light bg-bg-mid px-3 py-2 shadow-panel-elev',
              'text-xs font-mono text-text-secondary hover:text-text-primary transition-colors',
            )}
            aria-label="Show legend"
            aria-expanded={false}
          >
            <IconChevronRight size={14} className="shrink-0" />
            <span>legend</span>
          </motion.button>
        ) : (
          <motion.div
            key="legend-expanded"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'rounded-xl border border-bg-light bg-bg-mid p-4 shadow-panel-elev',
            )}
            role="note"
            aria-label="Map legend"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-xs font-semibold tracking-wide text-text-primary">
                Legend
              </span>
              <button
                type="button"
                onClick={toggleLegend}
                className="rounded p-1 text-text-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                aria-label="Hide legend"
                aria-expanded={true}
              >
                <IconChevronRight
                  size={14}
                  className="rotate-90 transition-transform"
                />
              </button>
            </div>
            <ul className="space-y-2 font-mono text-xs leading-relaxed text-text-secondary">
              <li className="flex items-center gap-2.5">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm bg-bg-elev border border-bg-light"
                  aria-hidden="true"
                />
                <span>Building = room</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full bg-accent-cyan shadow-[0_0_8px_rgba(0,212,255,0.6)]"
                  aria-hidden="true"
                />
                <span>Cyan = signed (DID verified)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full bg-white"
                  aria-hidden="true"
                />
                <span>White = unsigned (nick)</span>
              </li>
              <li className="pt-1 text-[11px] text-text-muted">
                Click building or agent to inspect
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Legend;
