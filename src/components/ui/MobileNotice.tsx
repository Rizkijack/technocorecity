'use client';

import { useEffect, useState } from 'react';
import { useUiStore } from '@/stores/ui-store';
import { InfoIcon, CloseIcon } from './icons';

export function MobileNotice() {
  const dismissed = useUiStore((s) => s.mobileNoticeDismissed);
  const dismissMobileNotice = useUiStore((s) => s.dismissMobileNotice);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (dismissed || !isMobile) return null;

  return (
    <div
      className="fixed top-12 left-0 right-0 z-25 md:hidden bg-bg-mid/95 backdrop-blur border-b border-bg-light px-4 py-2 flex items-center gap-2"
      role="status"
    >
      <InfoIcon className="w-4 h-4 text-text-secondary shrink-0" />
      <span className="text-xs text-text-secondary flex-1">
        Best viewed on desktop — tap a building to open messages.
      </span>
      <button
        type="button"
        onClick={dismissMobileNotice}
        className="text-text-secondary hover:text-text-primary p-1 -m-1"
        aria-label="Dismiss"
      >
        <CloseIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default MobileNotice;
