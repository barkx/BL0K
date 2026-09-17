import { Wordmark } from './Logo'
import { OptionsMenu } from './OptionsMenu'

/**
 * The mark, the sidebar toggle, and which design option is on screen.
 *
 * It was bare on purpose, and mostly still is. Render mode and the image
 * snapshot live in Settings and framing moved onto the ground itself, because a
 * toolbar holding three unrelated controls is a place things accumulate.
 *
 * The option menu earns the exception: which scheme you are looking at is true
 * of the whole window rather than of any one panel, and putting it in a tab
 * would mean the answer to "which option is this?" was hidden behind whichever
 * tab you were not on.
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
      <OptionsMenu />
    </div>
  )
}
