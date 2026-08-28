'use client';

import type { FC } from 'react';

export type IconProps = {
  className?: string;
  size?: number;
};

const base = {
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconClose: FC<IconProps> = ({ className, size = 24 }) => (
  <svg
    width={size}
    height={size}
    {...base}
    className={className}
    aria-hidden="true"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconExternalLink: FC<IconProps> = ({ className, size = 24 }) => (
  <svg
    width={size}
    height={size}
    {...base}
    className={className}
    aria-hidden="true"
  >
    <path d="M14 4h6v6" />
    <path d="M10 14L20 4" />
    <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
  </svg>
);

export const IconCopy: FC<IconProps> = ({ className, size = 24 }) => (
  <svg
    width={size}
    height={size}
    {...base}
    className={className}
    aria-hidden="true"
  >
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);

export const IconInfo: FC<IconProps> = ({ className, size = 24 }) => (
  <svg
    width={size}
    height={size}
    {...base}
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8h.01" />
    <path d="M11 12h1v4h1" />
  </svg>
);

export const IconLoading: FC<IconProps> = ({ className, size = 24 }) => (
  <svg
    width={size}
    height={size}
    {...base}
    className={className}
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export const IconSpinner: FC<IconProps> = IconLoading;

export const IconChevronRight: FC<IconProps> = ({ className, size = 24 }) => (
  <svg
    width={size}
    height={size}
    {...base}
    className={className}
    aria-hidden="true"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconEye: FC<IconProps> = ({ className, size = 24 }) => (
  <svg
    width={size}
    height={size}
    {...base}
    className={className}
    aria-hidden="true"
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconSearch: FC<IconProps> = ({ className, size = 24 }) => (
  <svg
    width={size}
    height={size}
    {...base}
    className={className}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

// Backward-compatible aliases (existing imports use CloseIcon etc.)
export const CloseIcon = IconClose;
export const ExternalLinkIcon = IconExternalLink;
export const CopyIcon = IconCopy;
export const InfoIcon = IconInfo;
export const SpinnerIcon = IconSpinner;
export const LoadingIcon = IconLoading;
export const ChevronRightIcon = IconChevronRight;
export const EyeIcon = IconEye;
export const SearchIcon = IconSearch;
