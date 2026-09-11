/**
 * The BL0K mark: one axonometric block, three flat faces, no strokes.
 *
 * Deliberately the simplest thing that still reads as a block — three paths and
 * three tints of `currentColor`, so it survives being 16 px in a browser tab
 * and inherits whatever colour it sits in.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3 21 8 12 13 3 8Z" />
      <path d="M3 8 12 13v8L3 16Z" opacity="0.55" />
      <path d="M21 8v8l-9 5v-8Z" opacity="0.78" />
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
      <span className="brand-tag">Parametric building design</span>
    </span>
  )
}
