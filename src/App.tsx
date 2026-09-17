import { useEffect, useState } from 'react'
import { Scene } from './scene/Scene'
import { Sidebar } from './ui/Sidebar'
import { Toolbar } from './ui/Toolbar'
import { MetricsPanel } from './ui/MetricsPanel'
import { SelectionPanel } from './ui/SelectionPanel'
import { useStore, type Tool } from './store/store'
import { DEFAULT_UNDERLAY_WIDTH } from './site/types'
import { loadUnderlayImage } from './io/image'

/** Keys that only mean something while a boundary is being traced. */
function useDrawShortcuts() {
  const plotMode = useStore((s) => s.plotMode)
  const finishPlotDraw = useStore((s) => s.finishPlotDraw)
  const cancelPlotDraw = useStore((s) => s.cancelPlotDraw)
  const undoDraftPoint = useStore((s) => s.undoDraftPoint)
  const finishSpineDraw = useStore((s) => s.finishSpineDraw)

  useEffect(() => {
    // The boundary and a building's centreline are traced with the same three
    // keys; only what Enter commits to differs.
    if (plotMode !== 'draw' && plotMode !== 'spine') return
    const onKey = (event: KeyboardEvent) => {
      // Never steal keys from a field the user is typing in.
      const el = event.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return

      if (event.key === 'Enter') {
        event.preventDefault()
        if (plotMode === 'spine') finishSpineDraw()
        else finishPlotDraw()
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
  }, [plotMode, finishPlotDraw, finishSpineDraw, cancelPlotDraw, undoDraftPoint])
}

/**
 * Undo and redo, on the keys every other tool uses.
 *
 * Kept out of the tracing handler above because it is live in every mode: the
 * one thing you want after a mistake is the same key wherever you made it.
 * A field with a cursor in it keeps its own undo — stealing that would break
 * typing a number.
 */
function useHistoryKeys() {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return
      const el = event.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])
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

const DRAWING: Record<string, string> = {
  draw: 'Click to place a corner · Enter or the red corner closes it · Backspace undoes · Esc cancels',
  spine: 'Click to trace the building · Enter builds it · Backspace undoes · Esc cancels',
  calibrate: 'Click two points whose real distance you know, then enter that distance',
}

/**
 * What the viewport does right now, which depends on the open tab.
 *
 * A tab is also a tool, so the same press means different things in different
 * sections. That is only workable if the app says which — a modal interface
 * that keeps its modes secret is just an unreliable one.
 */
const BY_TOOL: Record<Tool, string> = {
  site: 'Drag a corner to reshape the plot · click a midpoint to add one · right-click a corner to remove it',
  placement: 'Drag a building to place it · click it again for Massing',
  massing: 'Drag a core along its track · click a face for Facade',
  program: 'Switch to Diagram in Settings to see the programme on the model',
  facade: 'Click a face to override it · click it again to clear',
  units: 'Click a building to select it',
  drawings: 'Click a building to select it — the site plan draws them all',
  settings: 'Click a building to select it',
}

const NAVIGATION = 'Drag to orbit · scroll to zoom · double-click the ground to frame the site'

export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const plotMode = useStore((s) => s.plotMode)
  const tool = useStore((s) => s.tool)
  const { handlers, dropping, error, clearError } = useImageDrop()
  useDrawShortcuts()
  useHistoryKeys()

  return (
    <div className={collapsed ? 'app collapsed' : 'app'}>
      <Toolbar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Sidebar />
      <div className="viewport" {...handlers}>
        <Scene />
        <MetricsPanel />
        <SelectionPanel />
        <div className={plotMode === 'idle' ? 'hintbar' : 'hintbar drawing'}>
          {DRAWING[plotMode] ?? `${NAVIGATION} · ${BY_TOOL[tool]}`}
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
