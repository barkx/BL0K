import { Wordmark } from './Logo'

/**
 * Deliberately bare: the mark and the sidebar toggle, nothing else.
 *
 * Render mode and the image snapshot moved to Settings, and framing the view
 * moved onto the ground itself — double-click it. A toolbar that holds three
 * unrelated controls is a place things accumulate, and the viewport is worth
 * more than the strip above it.
 */
export function Toolbar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <div className="toolbar">
      <button
        className="ghost"
        onClick={onToggle}
        aria-expanded={!collapsed}
        title={collapsed ? 'Show parameters' : 'Hide parameters'}
      >
        ☰
      </button>
      <h1><Wordmark /></h1>
      <span className="spacer" />
    </div>
  )
}
