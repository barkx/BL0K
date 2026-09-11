/**
 * Sidebar icons: 18 px, single stroke weight, geometric — the same drawing
 * language as the mark and the diagram render mode. No filled shapes, so they
 * sit quietly next to the model rather than competing with it.
 */

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
} as const

/** A plot boundary with a corner handle. */
export const IconSite = () => (
  <svg {...base}>
    <path d="M4 8.5 12 4l8 3.5-1.5 11H5.5Z" />
    <circle cx="12" cy="4" r="1.6" fill="currentColor" stroke="none" />
  </svg>
)

/** A block on a baseline, with move arrows. */
export const IconPlacement = () => (
  <svg {...base}>
    <rect x="8" y="7" width="8" height="8" rx="1" />
    <path d="M3 20h18M5.5 11H3M21 11h-2.5M12 4.5V3" />
  </svg>
)

/** Two stacked masses. */
export const IconMassing = () => (
  <svg {...base}>
    <path d="M4 20V12h7v8" />
    <path d="M11 20V6h9v14" />
    <path d="M3 20h18" />
  </svg>
)

/** A facade grid of openings. */
export const IconFacade = () => (
  <svg {...base}>
    <rect x="4" y="3.5" width="16" height="17" rx="1.2" />
    <path d="M9.5 3.5v17M14.5 3.5v17M4 9.5h16M4 15h16" />
  </svg>
)

/** Cells, as in a unit mix. */
export const IconUnits = () => (
  <svg {...base}>
    <rect x="3.5" y="5" width="17" height="14" rx="1.2" />
    <path d="M3.5 12h17M12 5v14" />
  </svg>
)

/** Sliders. */
export const IconSettings = () => (
  <svg {...base}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
)
