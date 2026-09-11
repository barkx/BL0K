/**
 * The BL0K mark: a stepped axonometric block, drawn the way the app draws in
 * diagram mode — thin ink line work over flat tints, no gradients. It reads at
 * 16 px as a favicon and at 22 px in the toolbar.
 *
 * Kept as inline SVG rather than an asset so it inherits `currentColor` and
 * stays crisp at any density.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* lower mass */}
      <path d="M2 13.4 L9 9.4 L16 13.4 L9 17.4 Z" fill="currentColor" opacity="0.13" />
      <path
        d="M2 13.4 L9 9.4 L16 13.4 L9 17.4 Z M2 13.4 V17.6 L9 21.6 V17.4 M16 13.4 V17.6 L9 21.6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* upper mass, stepped back */}
      <path d="M9 5.2 L15 8.6 L21 5.2 L15 1.8 Z" fill="currentColor" opacity="0.22" />
      <path
        d="M9 5.2 L15 8.6 L21 5.2 L15 1.8 Z M9 5.2 V9.4 L15 12.8 V8.6 M21 5.2 V9.4 L15 12.8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Mark plus wordmark, as used in the toolbar. */
export function Wordmark() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Logo />
      </span>
      <span className="brand-name">BL0K</span>
      <span className="brand-tag">Early-stage urbanism</span>
    </span>
  )
}
