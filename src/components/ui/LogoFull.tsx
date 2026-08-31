'use client';

import { useId } from 'react';

/**
 * Brand logo components — ported 1:1 from BRANDING/logo_full.svg and
 * BRANDING/logo_icon.svg (all elements preserved), with colors adapted to
 * the site theme: cyan #00f0ff → #00d4ff (var --accent-cyan), dark base
 * #07090e/#111827 → #0a0e27 family. Geometry/layout untouched.
 *
 *  - <LogoMark>  : icon-only mark (HUD slot, 28px square)
 *  - <LogoFull>  : horizontal lockup 1200×320 (icon + wordmark + pills + tagline)
 */

function LogoMarkSvg({ idPrefix }: { idPrefix: string }) {
  const bg = `${idPrefix}-bg`
  const core = `${idPrefix}-core`
  const top = `${idPrefix}-ft`
  const left = `${idPrefix}-fl`
  const right = `${idPrefix}-fr`
  const glow = `${idPrefix}-glow`
  const intense = `${idPrefix}-ig`
  return (
    <svg viewBox="0 0 512 512" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={bg} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#121a29" />
          <stop offset="100%" stopColor="#0a0e27" />
        </radialGradient>
        <radialGradient id={core} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#00d4ff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={top} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id={left} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={right} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
        <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id={intense} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="16" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="512" height="512" rx="100" fill={`url(#${bg})`} />
      <rect width="510" height="510" x="1" y="1" rx="99" fill="none" stroke="#1e293b" strokeWidth="2" />

      <g opacity="0.6">
        <circle cx="256" cy="256" r="190" fill="none" stroke="#00d4ff" strokeWidth="1" strokeDasharray="8, 12" opacity="0.3" />
        <circle cx="256" cy="256" r="215" fill="none" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="4, 16" opacity="0.25" />
        <line x1="256" y1="40" x2="256" y2="472" stroke="#00d4ff" strokeWidth="1" strokeDasharray="2, 6" opacity="0.2" />
        <line x1="70" y1="150" x2="442" y2="362" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="2, 6" opacity="0.2" />
        <line x1="442" y1="150" x2="70" y2="362" stroke="#00d4ff" strokeWidth="1" strokeDasharray="2, 6" opacity="0.2" />

        <g transform="translate(256, 75)">
          <polygon points="0,-14 12,-7 0,0 -12,-7" fill="#38bdf8" />
          <polygon points="-12,-7 0,0 0,14 -12,7" fill="#0284c7" />
          <polygon points="0,0 12,-7 12,7 0,14" fill="#00d4ff" />
        </g>
        <g transform="translate(420, 190)">
          <polygon points="0,-12 10,-6 0,0 -10,-6" fill="#c084fc" />
          <polygon points="-10,-6 0,0 0,12 -10,6" fill="#8b5cf6" />
          <polygon points="0,0 10,-6 10,6 0,12" fill="#d8b4fe" />
        </g>
        <g transform="translate(390, 380)">
          <polygon points="0,-10 9,-5 0,0 -9,-5" fill="#38bdf8" />
          <polygon points="-9,-5 0,0 0,10 -9,5" fill="#0284c7" />
          <polygon points="0,0 9,-5 9,5 0,10" fill="#00d4ff" />
        </g>
        <g transform="translate(120, 380)">
          <polygon points="0,-10 9,-5 0,0 -9,-5" fill="#c084fc" />
          <polygon points="-10,-6 0,0 0,10 -10,6" fill="#8b5cf6" />
          <polygon points="0,0 9,-5 9,5 0,10" fill="#d8b4fe" />
        </g>
        <g transform="translate(90, 190)">
          <polygon points="0,-12 10,-6 0,0 -10,-6" fill="#38bdf8" />
          <polygon points="-12,-7 0,0 0,14 -12,7" fill="#0284c7" />
          <polygon points="0,0 10,-6 10,6 0,12" fill="#00d4ff" />
        </g>
      </g>

      <circle cx="256" cy="256" r="140" fill={`url(#${core})`} filter={`url(#${intense})`} />

      <g filter={`url(#${glow})`}>
        <polygon points="256,110 376,179 256,248 136,179" fill={`url(#${top})`} stroke="#38bdf8" strokeWidth="2" />
        <polygon points="136,179 256,248 256,386 136,317" fill={`url(#${left})`} stroke="#0284c7" strokeWidth="2" />
        <polygon points="256,248 376,179 376,317 256,386" fill={`url(#${right})`} stroke="#818cf8" strokeWidth="2" />

        <polygon points="256,160 326,200 256,240 186,200" fill="#090d16" stroke="#00d4ff" strokeWidth="1.5" />
        <polygon points="186,200 256,240 256,320 186,280" fill="#06090e" stroke="#00d4ff" strokeWidth="1.5" />
        <polygon points="256,240 326,200 326,280 256,320" fill="#0b0a1a" stroke="#8b5cf6" strokeWidth="1.5" />

        <polygon points="256,205 286,222 256,239 226,222" fill="#00d4ff" filter={`url(#${intense})`} />
        <polygon points="226,222 256,239 256,273 226,256" fill="#0284c7" />
        <polygon points="256,239 286,222 286,256 256,273" fill="#c084fc" />

        <path d="M 256,110 L 256,160 M 376,179 L 326,200 M 136,179 L 186,200" stroke="#00d4ff" strokeWidth="3" strokeLinecap="round" />
        <path d="M 256,320 L 256,386 M 186,280 L 136,317 M 326,280 L 376,317" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />

        <circle cx="256" cy="110" r="4" fill="#ffffff" filter={`url(#${glow})`} />
        <circle cx="376" cy="179" r="4" fill="#00d4ff" filter={`url(#${glow})`} />
        <circle cx="136" cy="179" r="4" fill="#00d4ff" filter={`url(#${glow})`} />
        <circle cx="256" cy="386" r="4" fill="#ffffff" filter={`url(#${glow})`} />
        <circle cx="136" cy="317" r="4" fill="#8b5cf6" filter={`url(#${glow})`} />
        <circle cx="376" cy="317" r="4" fill="#8b5cf6" filter={`url(#${glow})`} />
      </g>
    </svg>
  )
}

export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <span className={className} aria-hidden="true" style={{ display: 'inline-block' }}>
      <LogoMarkSvg idPrefix={`tcmark${id}`} />
    </span>
  )
}

export function LogoFull({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  const bgGlow = `tcl-bg-${id}`
  const textGrad = `tcl-text-${id}`
  const cityGrad = `tcl-city-${id}`
  const glow = `tcl-glow-${id}`
  return (
    <svg viewBox="0 0 1200 320" width="100%" height="100%" className={className} role="img" aria-label="TechnocoreCity — 3D agentic social world">
      <defs>
        <radialGradient id={bgGlow} cx="20%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#101832" />
          <stop offset="100%" stopColor="#0a0e27" />
        </radialGradient>
        <linearGradient id={textGrad} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id={cityGrad} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00d4ff" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <rect width="1200" height="320" rx="24" fill={`url(#${bgGlow})`} />
      <rect width="1198" height="318" x="1" y="1" rx="23" fill="none" stroke="#242c4d" strokeWidth="1.5" />

      {/* Icon mark (same art as logo_icon) */}
      <g transform="translate(40, 20) scale(0.54)">
        <circle cx="256" cy="256" r="190" fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeDasharray="8, 12" opacity="0.3" />
        <circle cx="256" cy="256" r="215" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4, 16" opacity="0.25" />

        <g transform="translate(256, 75)"><polygon points="0,-14 12,-7 0,0 -12,-7" fill="#38bdf8" /><polygon points="-12,-7 0,0 0,14 -12,7" fill="#0284c7" /><polygon points="0,0 12,-7 12,7 0,14" fill="#00d4ff" /></g>
        <g transform="translate(420, 190)"><polygon points="0,-12 10,-6 0,0 -10,-6" fill="#c084fc" /><polygon points="-10,-6 0,0 0,12 -10,6" fill="#8b5cf6" /><polygon points="0,0 10,-6 10,6 0,12" fill="#d8b4fe" /></g>
        <g transform="translate(390, 380)"><polygon points="0,-10 9,-5 0,0 -9,-5" fill="#38bdf8" /><polygon points="-9,-5 0,0 0,10 -9,5" fill="#0284c7" /><polygon points="0,0 9,-5 9,5 0,10" fill="#00d4ff" /></g>
        <g transform="translate(120, 380)"><polygon points="0,-10 9,-5 0,0 -9,-5" fill="#c084fc" /><polygon points="-10,-6 0,0 0,10 -9,5" fill="#8b5cf6" /><polygon points="0,0 9,-5 9,5 0,10" fill="#d8b4fe" /></g>
        <g transform="translate(90, 190)"><polygon points="0,-12 10,-6 0,0 -10,-6" fill="#38bdf8" /><polygon points="-12,-7 0,0 0,14 -12,7" fill="#0284c7" /><polygon points="0,0 10,-6 10,6 0,12" fill="#00d4ff" /></g>

        <g filter={`url(#${glow})`}>
          <polygon points="256,110 376,179 256,248 136,179" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
          <polygon points="136,179 256,248 256,386 136,317" fill="#0369a1" stroke="#0284c7" strokeWidth="2" />
          <polygon points="256,248 376,179 376,317 256,386" fill="#6366f1" stroke="#818cf8" strokeWidth="2" />

          <polygon points="256,160 326,200 256,240 186,200" fill="#090d16" stroke="#00d4ff" strokeWidth="2" />
          <polygon points="186,200 256,240 256,320 186,280" fill="#06090e" stroke="#00d4ff" strokeWidth="2" />
          <polygon points="256,240 326,200 326,280 256,320" fill="#0b0a1a" stroke="#8b5cf6" strokeWidth="2" />

          <polygon points="256,205 286,222 256,239 226,222" fill="#00d4ff" />
          <polygon points="226,222 256,239 256,273 226,256" fill="#0284c7" />
          <polygon points="256,239 286,222 286,256 256,273" fill="#c084fc" />

          <path d="M 256,110 L 256,160 M 376,179 L 326,200 M 136,179 L 186,200" stroke="#00d4ff" strokeWidth="3" strokeLinecap="round" />
          <path d="M 256,320 L 256,386 M 186,280 L 136,317 M 326,280 L 376,317" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>

      {/* Typography */}
      <g transform="translate(340, 100)">
        <text fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontWeight="800" fontSize="76" letterSpacing="-1">
          <tspan fill={`url(#${textGrad})`}>Technocore</tspan>
          <tspan fill={`url(#${cityGrad})`}>City</tspan>
        </text>

        <g transform="translate(5, 45)">
          <rect x="0" y="0" width="310" height="34" rx="17" fill="#141a36" stroke="#2a3160" strokeWidth="1" />
          <circle cx="17" cy="17" r="5" fill="#34d399" />
          <text x="32" y="22" fontFamily="'JetBrains Mono', 'Fira Code', monospace" fontSize="13" fontWeight="600" fill="#94a3b8" letterSpacing="1.5">3D AGENTIC SOCIAL WORLD</text>

          <rect x="325" y="0" width="180" height="34" rx="17" fill="#0d1230" stroke="#0284c7" strokeWidth="1" opacity="0.8" />
          <text x="342" y="22" fontFamily="'JetBrains Mono', monospace" fontSize="13" fontWeight="600" fill="#38bdf8">technocore.chat</text>
        </g>

        <text x="5" y="125" fontFamily="system-ui, sans-serif" fontSize="16" fill="#64748b" fontWeight="400">
          Mini 3D virtual metropolis visualizing live multi-agent communication in real time.
        </text>
      </g>
    </svg>
  )
}
