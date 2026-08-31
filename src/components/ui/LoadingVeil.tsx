'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { formatNumber } from '@/lib/utils/format';
import { IconSpinner } from './icons';
import { LogoFull } from './LogoFull';

export type LoadingVeilProps = {
  isVisible?: boolean;
  progress?: { loaded: number; total?: number };
  label?: string;
};

export function LoadingVeil({ isVisible = true, progress, label }: LoadingVeilProps) {
  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          key="loading-veil"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeIn' }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0e27]/80 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-busy={isVisible}
        >
          <LogoFull className="h-24 w-auto md:h-28" />
          <IconSpinner
            size={32}
            className="mt-5 h-8 w-8 animate-spin text-accent-cyan"
          />
          <p className="mt-4 text-sm font-medium tracking-wide text-text-secondary">
            {label ?? 'Loading TechnocoreCity…'}
          </p>
          {progress ? (
            <p className="mt-2 font-mono text-xs text-text-muted">
              {formatNumber(progress.loaded)}
              {progress.total !== undefined ? ` / ${formatNumber(progress.total)}` : ' loaded'}
            </p>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default LoadingVeil;
