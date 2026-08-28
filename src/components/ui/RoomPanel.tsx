'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { truncate } from '@/lib/utils/format';
import { useWorldStore } from '@/stores/world-store';
import { useRoomMessages } from '@/hooks/useRoomMessages';
import { IconClose, IconExternalLink } from './icons';
import { MessageItem } from './MessageItem';

export function RoomPanel() {
  const selectedRoomId = useWorldStore((s) => s.selectedRoomId);
  const selectRoom = useWorldStore((s) => s.selectRoom);
  const rooms = useWorldStore((s) => s.rooms);
  const { messages, isLoading } = useRoomMessages(selectedRoomId);

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
      // defer until after animation mount
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
            // Mobile: bottom sheet adaptation — still respects spec but responsive
            'max-sm:bottom-0 max-sm:top-auto max-sm:h-[72vh] max-sm:max-w-none max-sm:w-full max-sm:rounded-t-2xl max-sm:border-l-0 max-sm:border-t',
            // Tablet (md: 768–1023px): bottom sheet, slightly less tall, tighter top radius
            'md:bottom-0 md:top-auto md:right-0 md:left-0 md:h-auto md:max-h-[60vh] md:w-full md:max-w-none md:rounded-t-xl md:border-l-0 md:border-t',
            // Desktop (lg: 1024px+): revert to right-rail
            'lg:top-0 lg:bottom-auto lg:h-full lg:max-h-none lg:border-t-0 lg:border-l',
          )}
          role="dialog"
          aria-modal="true"
          aria-label={selectedRoomId ? `Room: ${selectedRoomId}` : 'Room details'}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-bg-light px-4">
            <h2
              className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-text-primary"
              title={room?.name ?? selectedRoomId ?? undefined}
            >
              {room?.name ?? selectedRoomId}
            </h2>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={() => selectRoom(null)}
              className="ml-3 shrink-0 rounded p-1.5 text-text-secondary transition-colors hover:bg-bg-elev hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
              aria-label="Close panel"
            >
              <IconClose size={18} />
            </button>
          </header>

          {/* Topic */}
          {topic ? (
            <p
              className="shrink-0 truncate border-b border-bg-light/50 px-4 py-3 font-sans text-xs italic text-gray-400"
              title={topic}
            >
              {truncate(topic, 120)}
            </p>
          ) : null}

          {/* Messages */}
          <div className="scroll-area min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading messages">
                <div className="h-12 animate-pulse rounded-lg bg-bg-elev/60" />
                <div className="h-12 animate-pulse rounded-lg bg-bg-elev/40" />
                <div className="h-12 animate-pulse rounded-lg bg-bg-elev/30" />
              </div>
            ) : messages.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-text-muted">
                No messages yet
              </div>
            ) : (
              <div role="list">
                {messages.map((m, idx) => (
                  <MessageItem
                    key={m.seq}
                    message={m}
                    isNew={idx === messages.length - 1}
                  />
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
