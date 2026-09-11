import { useEffect, useState } from 'react'
import { Scene } from './scene/Scene'
import { Sidebar } from './ui/Sidebar'
import { Toolbar } from './ui/Toolbar'
import { MetricsPanel } from './ui/MetricsPanel'
import { SelectionPanel } from './ui/SelectionPanel'
import { useStore } from './store/store'

/** Keys that only mean something while a boundary is being traced. */
function useDrawShortcuts() {
  const plotMode = useStore((s) => s.plotMode)
  const finishPlotDraw = useStore((s) => s.finishPlotDraw)
  const cancelPlotDraw = useStore((s) => s.cancelPlotDraw)
  const undoDraftPoint = useStore((s) => s.undoDraftPoint)

  useEffect(() => {
    if (plotMode !== 'draw') return
    const onKey = (event: KeyboardEvent) => {
      // Never steal keys from a field the user is typing in.
      const el = event.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return

      if (event.key === 'Enter') {
        event.preventDefault()
        finishPlotDraw()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        cancelPlotDraw()
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        undoDraftPoint()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [plotMode, finishPlotDraw, cancelPlotDraw, undoDraftPoint])
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const plotMode = useStore((s) => s.plotMode)
  useDrawShortcuts()

  return (
    <div className={collapsed ? 'app collapsed' : 'app'}>
      <Toolbar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Sidebar />
      <div className="viewport">
        <Scene />
        <MetricsPanel />
        <SelectionPanel />
        <div className={plotMode === 'draw' ? 'hintbar drawing' : 'hintbar'}>
          {plotMode === 'draw'
            ? 'Click to place a corner · Enter or the red corner closes it · Backspace undoes · Esc cancels'
            : 'Drag to orbit · scroll to zoom · drag a building to place it · click its face to override'}
        </div>
      </div>
    </div>
  )
}
