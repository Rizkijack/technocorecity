'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { formatBytes, formatIdle, formatNumber, formatRoomName } from '@/lib/utils/format';
import { useWorldStore } from '@/stores/world-store';
import { useRoomMessages } from '@/hooks/useRoomMessages';
import { IconClose, IconExternalLink } from './icons';
import { MessageItem } from './MessageItem';

export function RoomPanel() {
  const selectedRoomId = useWorldStore((s) => s.selectedRoomId);
  const selectRoom = useWorldStore((s) => s.selectRoom);
  const rooms = useWorldStore((s) => s.rooms);
  const { messages, isLoading, error } = useRoomMessages(selectedRoomId);

  const room = selectedRoomId ? rooms.get(selectedRoomId) : undefined;
  const topic = room?.topic ?? '';
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Escape closes panel
  useEffect(() => {
    if (!selectedRoomId) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        selectRoom(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRoomId, selectRoom]);

  // Focus close button when panel opens (basic focus trap entry)
  useEffect(() => {
    if (selectedRoomId) {
      const id = window.setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [selectedRoomId]);

  // Basic focus trap: keep Tab inside panel
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const open = selectedRoomId !== null;
  const displayName = room?.name ?? selectedRoomId ?? '';
  const hasTopic = topic.trim().length > 0;

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="room-panel"
          ref={panelRef}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={cn(
            'fixed right-0 top-0 z-20 flex h-full w-full max-w-[400px] flex-col',
            'bg-bg-mid border-l border-bg-light shadow-panel-elev',
            'sm:w-[400px]',
            'max-sm:bottom-0 max-sm:top-auto max-sm:h-[72vh] max-sm:max-w-none max-sm:w-full max-sm:rounded-t-2xl max-sm:border-l-0 max-sm:border-t',
            'md:bottom-0 md:top-auto md:right-0 md:left-0 md:h-auto md:max-h-[60vh] md:w-full md:max-w-none md:rounded-t-xl md:border-l-0 md:border-t',
            'lg:top-0 lg:bottom-auto lg:h-full lg:max-h-none lg:border-t-0 lg:border-l',
          )}
          role="dialog"
          aria-modal="true"
          aria-label={selectedRoomId ? `Room: ${selectedRoomId}` : 'Room details'}
          onKeyDown={handleKeyDown}
        >
          {/* Header — solid, synced from world-store rooms Map (useRooms -> parseRooms) */}
          <header className="shrink-0 border-b border-bg-light px-4 py-3.5">
            {/* Row 1: live dot + r/name mono 14px bold + close */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="absolute inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                </span>
                <h2
                  className="min-w-0 flex-1 truncate font-mono text-[14px] font-bold leading-none text-text-primary"
                  title={displayName ? formatRoomName(displayName) : undefined}
                >
                  {formatRoomName(displayName)}
                </h2>
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-emerald-400"
                  aria-label="live"
                  title="live"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  LIVE
                </span>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => selectRoom(null)}
                className="ml-2 shrink-0 rounded p-1.5 text-text-secondary transition-colors hover:bg-bg-elev hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                aria-label="Close panel"
              >
                <IconClose size={18} />
              </button>
            </div>

            {/* Row 2: badges messageCount / size / idle — from world-store room prop */}
            {room ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-bg-elev px-2 py-0.5 font-mono text-[11px] font-medium text-text-secondary">
                  {formatNumber(room.messageCount)} msgs
                </span>
                <span className="inline-flex items-center rounded-full bg-bg-elev px-2 py-0.5 font-mono text-[11px] font-medium text-text-secondary">
                  {formatBytes(room.sizeBytes)}
                </span>
                <span className="inline-flex items-center rounded-full bg-bg-elev px-2 py-0.5 font-mono text-[11px] font-medium text-text-secondary">
                  {formatIdle(room.idleSeconds)} ago
                </span>
              </div>
            ) : null}

            {/* Row 3: topic lengkap, placeholder "-" if empty */}
            <p
              className="mt-2.5 break-words font-sans text-xs italic leading-relaxed text-gray-400"
              title={hasTopic ? topic : undefined}
            >
              {hasTopic ? topic : '-'}
            </p>
          </header>

          {/* Messages — synced via useRoomMessages (no manual fetch) */}
          <div className="scroll-area min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading messages">
                <div className="h-12 animate-pulse rounded-lg bg-bg-elev/60" />
                <div className="h-12 animate-pulse rounded-lg bg-bg-elev/40" />
                <div className="h-12 animate-pulse rounded-lg bg-bg-elev/30" />
              </div>
            ) : error ? (
              <div className="px-4 py-10 text-center" role="alert">
                <p className="text-sm font-medium text-red-400">Failed to load messages</p>
                <p className="mt-1 break-words text-xs text-text-muted">{error.message}</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-text-muted">No messages yet</div>
            ) : (
              <div role="list">
                {messages.map((m, idx) => (
                  <MessageItem key={m.seq} message={m} isNew={idx === messages.length - 1} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="shrink-0 border-t border-bg-light px-4 py-3">
            <a
              href={`https://technocore.chat/r/${encodeURIComponent(selectedRoomId ?? '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-accent-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            >
              <span>View on technocore.chat</span>
              <IconExternalLink size={14} className="shrink-0" />
            </a>
          </footer>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

export default RoomPanel;
