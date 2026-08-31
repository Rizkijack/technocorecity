'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { matchesRoomQuery } from '@/lib/technocore/intake';
import { useUiStore } from '@/stores/ui-store';
import { useWorldStore } from '@/stores/world-store';
import { LogoMark } from './LogoFull';
import { IconClose, IconEye, IconSearch } from './icons';

export function Hud() {
  const legendCollapsed = useUiStore((s) => s.legendCollapsed);
  const toggleLegend = useUiStore((s) => s.toggleLegend);
  const searchQuery = useWorldStore((s) => s.searchQuery);
  const setSearchQuery = useWorldStore((s) => s.setSearchQuery);
  const rooms = useWorldStore((s) => s.rooms);
  const [online, setOnline] = useState<boolean>(true);

  const matched = useMemo(
    () =>
      Array.from(rooms.values()).filter((room) =>
        matchesRoomQuery(room, searchQuery),
      ).length,
    [rooms, searchQuery],
  );

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setOnline(navigator.onLine);
    const handleOnline = (): void => setOnline(true);
    const handleOffline = (): void => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header
      className={cn(
        'fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between px-4',
        'bg-[#0a0e27]/60 backdrop-blur border-b border-bg-light/30',
      )}
      role="banner"
    >
      {/* Left: logo + title + connection — brand lockup from BRANDING/logo_full.svg */}
      <div className="flex min-w-0 items-center gap-3">
        <LogoMark className="h-7 w-7 shrink-0 drop-shadow-[0_0_12px_rgba(0,212,255,0.35)]" />
        <span className="truncate font-sans text-sm font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-white via-slate-100 to-sky-400 bg-clip-text text-transparent">
            Technocore
          </span>
          <span className="bg-gradient-to-r from-accent-cyan to-[#a855f7] bg-clip-text text-transparent">
            City
          </span>
        </span>
        {/* Brand pills from logo_full (hidden below lg — header structure unchanged) */}
        <span className="hidden items-center gap-2 lg:flex" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-bg-light/30 bg-bg-mid/50 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest text-text-secondary">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green" aria-hidden="true" />
            3D AGENTIC SOCIAL WORLD
          </span>
          <span className="hidden rounded-full border border-sky-600/50 bg-bg-deep/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-400 xl:inline-flex">
            technocore.chat
          </span>
        </span>
        <span className="hidden items-center gap-1.5 sm:flex" aria-live="polite">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              online
                ? 'bg-accent-green shadow-[0_0_6px_rgba(74,222,128,0.6)]'
                : 'bg-text-muted',
            )}
            aria-hidden="true"
          />
          <span className="hidden font-mono text-xs text-text-muted md:inline">
            {online ? 'live' : 'offline'}
          </span>
        </span>
      </div>

      {/* Right: search + legend toggle */}
      <div className="flex shrink-0 items-center gap-2">
        <div
          className={cn(
            'hidden items-center gap-2 rounded-full border border-bg-light/30 bg-bg-mid/50 px-3 py-1.5 sm:flex',
            'focus-within:border-accent-cyan focus-within:ring-1 focus-within:ring-accent-cyan',
          )}
        >
          <IconSearch size={14} className="shrink-0 text-text-muted" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rooms…"
            aria-label="Search rooms"
            className="w-32 bg-transparent font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none md:w-44"
          />
          {searchQuery.length > 0 ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
            >
              <IconClose size={12} />
            </button>
          ) : null}
          <span className="shrink-0 font-mono text-[11px] text-text-muted">
            {matched}/{rooms.size}
          </span>
        </div>

        <button
          type="button"
          onClick={toggleLegend}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs transition-colors',
            'border-bg-light/30 bg-bg-mid/50 text-text-secondary hover:border-bg-light hover:text-text-primary',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan',
          )}
          aria-label={legendCollapsed ? 'Show legend' : 'Hide legend'}
          aria-expanded={!legendCollapsed}
        >
          <IconEye size={14} className="shrink-0" />
          <span className="hidden sm:inline">Legend</span>
        </button>

        {/* Mobile connection dot (visible when left live label hidden) */}
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full sm:hidden',
            online ? 'bg-accent-green' : 'bg-text-muted',
          )}
          aria-hidden="true"
        />
      </div>
    </header>
  );
}

export default Hud;
