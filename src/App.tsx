import { useEffect, useState } from 'react'
import { Scene } from './scene/Scene'
import { Sidebar } from './ui/Sidebar'
import { Toolbar } from './ui/Toolbar'
import { MetricsPanel } from './ui/MetricsPanel'
import { SelectionPanel } from './ui/SelectionPanel'
import { useStore } from './store/store'
import { DEFAULT_UNDERLAY_WIDTH } from './site/types'
import { loadUnderlayImage } from './io/image'

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

/** Dropping an image anywhere on the viewport loads it as the underlay. */
function useImageDrop() {
  const setUnderlay = useStore((s) => s.setUnderlay)
  const [dropping, setDropping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlers = {
    onDragOver: (event: React.DragEvent) => {
      if (!Array.from(event.dataTransfer.types).includes('Files')) return
      event.preventDefault()
      setDropping(true)
    },
    onDragLeave: (event: React.DragEvent) => {
      // Ignore the flicker as the pointer crosses child elements.
      if (event.currentTarget.contains(event.relatedTarget as Node)) return
      setDropping(false)
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault()
      setDropping(false)
      const file = event.dataTransfer.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setError('That is not an image. Drop a PNG or JPEG of a map or site plan.')
        return
      }
      setError(null)
      void loadUnderlayImage(file)
        .then((image) =>
          setUnderlay({
            src: image.src,
            name: image.name,
            width: DEFAULT_UNDERLAY_WIDTH,
            aspect: image.aspect,
            position: { x: 0, z: 0 },
            rotation: 0,
            opacity: 0.75,
            visible: true,
            locked: false,
          }),
        )
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'That image could not be loaded.'),
        )
    },
  }

  return { handlers, dropping, error, clearError: () => setError(null) }
}

const HINTS: Record<string, string> = {
  draw: 'Click to place a corner · Enter or the red corner closes it · Backspace undoes · Esc cancels',
  calibrate: 'Click two points whose real distance you know, then enter that distance',
  idle: 'Drag to orbit · scroll to zoom · drag a building to place it · click its face to override',
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const plotMode = useStore((s) => s.plotMode)
  const { handlers, dropping, error, clearError } = useImageDrop()
  useDrawShortcuts()

  return (
    <div className={collapsed ? 'app collapsed' : 'app'}>
      <Toolbar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Sidebar />
      <div className="viewport" {...handlers}>
        <Scene />
        <MetricsPanel />
        <SelectionPanel />
        <div className={plotMode === 'idle' ? 'hintbar' : 'hintbar drawing'}>
          {HINTS[plotMode] ?? HINTS.idle}
        </div>
        {dropping && <div className="dropzone">Drop the image to lay it on the ground</div>}
        {error && (
          <button className="droperror" onClick={clearError}>
            {error}
          </button>
        )}
      </div>
    </div>
  )
}
