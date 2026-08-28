'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorldStore } from '@/stores/world-store';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { IconClose, IconCopy } from './icons';

export function AgentPopover() {
  const selectedAgentKey = useWorldStore((s) => s.selectedAgentKey);
  const selectedAgentScreenPos = useWorldStore(
    (s) => s.selectedAgentScreenPos,
  );
  const agents = useWorldStore((s) => s.agents);
  const selectAgent = useWorldStore((s) => s.selectAgent);

  const { copy, isCopied } = useCopyToClipboard();
  const popoverRef = useRef<HTMLDivElement>(null);

  const open = selectedAgentKey !== null;
  const agent = selectedAgentKey ? agents.get(selectedAgentKey) : undefined;

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        selectAgent(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, selectAgent]);

  // Outside click closes (defer binding to avoid opener click race)
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (popoverRef.current && target && !popoverRef.current.contains(target)) {
        selectAgent(null);
      }
    };
    const timeoutId = window.setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, selectAgent]);

  const fallbackX =
    typeof window === 'undefined' ? 0 : window.innerWidth / 2 - 160;
  const fallbackY =
    typeof window === 'undefined' ? 0 : window.innerHeight / 2 - 100;

  const rawX = selectedAgentScreenPos?.x ?? fallbackX;
  const rawY = selectedAgentScreenPos?.y ?? fallbackY;

  // Clamp to viewport so popover never overflows (spec: not overflow viewport)
  const viewportW = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const viewportH = typeof window === 'undefined' ? 768 : window.innerHeight;
  const POPOVER_W = 320;
  const POPOVER_H = 180;
  const clamp = (v: number, min: number, max: number): number =>
    Math.min(Math.max(v, min), max);
  const x = clamp(rawX, 8, viewportW - POPOVER_W - 8);
  const y = clamp(rawY, 8, viewportH - POPOVER_H - 8);

  return (
    <AnimatePresence>
      {open && agent ? (
        <motion.div
          key="agent-popover"
          ref={popoverRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed z-[25] w-[320px] max-w-[320px] rounded-lg border border-bg-light bg-bg-elev p-4 shadow-panel-elev"
          style={{ left: x, top: y }}
          role="dialog"
          aria-label="Agent details"
          aria-modal="false"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {agent.isSigned ? (
                <>
                  <div
                    className="truncate font-mono text-sm font-medium text-accent-cyan"
                    title={agent.displayName}
                  >
                    {agent.displayName.slice(0, 16) || 'unknown'}
                  </div>
                  <div className="mt-1 break-all font-mono text-[11px] leading-relaxed text-text-secondary">
                    {agent.didKey ?? 'did:key:unknown'}
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="truncate font-mono text-sm font-medium text-white"
                    title={agent.displayName}
                  >
                    {agent.displayName || 'anonymous'}
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    (self-asserted, not verified)
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => selectAgent(null)}
              className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-bg-mid hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
              aria-label="Close agent details"
            >
              <IconClose size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-bg-light pt-3">
            <span className="font-mono text-xs text-text-muted">
              {agent.messageCount} {agent.messageCount === 1 ? 'message' : 'messages'} in this room
            </span>
            {agent.isSigned && agent.didKey ? (
              <button
                type="button"
                onClick={() => {
                  void copy(agent.didKey ?? '');
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded bg-bg-mid px-2 py-1 font-mono text-xs text-text-secondary transition-colors hover:text-accent-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                aria-label="Copy DID"
              >
                <IconCopy size={14} className="shrink-0" />
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default AgentPopover;
