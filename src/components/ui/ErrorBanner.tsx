'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { useUiStore } from '@/stores/ui-store';
import { IconClose } from './icons';

export type ErrorBannerVariant = 'error' | 'warning' | 'info';

export type ErrorBannerProps = {
  error?: Error | { message: string } | null;
  variant?: ErrorBannerVariant;
  onRetry?: () => void;
  onDismiss?: () => void;
};

const VARIANT_CLASSES: Record<ErrorBannerVariant, string> = {
  error: 'bg-[#ff5470]/15 border-b border-[#ff5470]/30 text-[#ffdbe2]',
  warning: 'bg-[#ffb547]/15 border-b border-[#ffb547]/30 text-[#fff3db]',
  info: 'bg-[#00d4ff]/10 border-b border-[#00d4ff]/30 text-cyan-50',
};

export function ErrorBanner({
  error: errorProp,
  variant: variantProp,
  onRetry,
  onDismiss,
}: ErrorBannerProps) {
  const storeBanner = useUiStore((s) => s.errorBanner);
  const storeDismiss = useUiStore((s) => s.dismissError);

  // Resolve message source: prop takes precedence, else store
  const propMessage =
    errorProp !== undefined && errorProp !== null
      ? errorProp.message
      : undefined;

  const storeMessage = storeBanner?.message;

  const message = propMessage ?? storeMessage ?? null;

  const resolvedVariant: ErrorBannerVariant =
    variantProp ?? storeBanner?.variant ?? 'error';

  const handleDismiss = onDismiss ?? storeDismiss;

  const hasError = message !== null && message !== '';

  // Auto-dismiss info after 5s
  useEffect(() => {
    if (!hasError) return;
    if (resolvedVariant !== 'info') return;
    const timer = window.setTimeout(() => {
      handleDismiss();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [hasError, resolvedVariant, handleDismiss, message]);

  if (!hasError) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={`banner-${resolvedVariant}-${message}`}
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -48, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'fixed left-0 right-0 top-0 z-40',
          VARIANT_CLASSES[resolvedVariant],
        )}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 truncate font-mono text-sm">
            {message}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md bg-white/10 px-3 py-1 font-mono text-xs font-medium text-inherit hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label="Retry"
              >
                Retry
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded p-1 text-inherit opacity-80 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Dismiss error"
            >
              <IconClose size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ErrorBanner;
