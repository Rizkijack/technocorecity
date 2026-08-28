'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { useUiStore } from '@/stores/ui-store';
import { IconEye, IconSearch } from './icons';

export function Hud() {
  const legendCollapsed = useUiStore((s) => s.legendCollapsed);
  const toggleLegend = useUiStore((s) => s.toggleLegend);
  const [online, setOnline] = useState<boolean>(true);

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
      {/* Left: logo + title + connection */}
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="h-7 w-7 shrink-0 rounded-md bg-gradient-to-br from-accent-cyan to-accent-magenta shadow-[0_0_12px_rgba(0,212,255,0.35)]"
          aria-hidden="true"
        />
        <span className="truncate font-sans text-sm font-semibold tracking-tight text-text-primary">
          TechnocoreCity
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

      {/* Right: legend toggle + search placeholder */}
      <div className="flex shrink-0 items-center gap-2">
        <div
          className={cn(
            'hidden items-center gap-2 rounded-full border border-bg-light/30 bg-bg-mid/50 px-3 py-1.5',
            'text-xs text-text-muted sm:flex',
          )}
          aria-hidden="true"
        >
          <IconSearch size={14} className="shrink-0 text-text-muted" />
          <span className="font-mono text-xs">Search rooms…</span>
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
