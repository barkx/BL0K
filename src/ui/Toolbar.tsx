import { useStore } from '../store/store'
import type { RenderMode } from '../store/params'
import { download, stamp } from '../io/config'

const MODES: { value: RenderMode; label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'pbr', label: 'PBR' },
  { value: 'diagram', label: 'Diagram' },
]

function saveImage() {
  const canvas = document.querySelector('.viewport canvas') as HTMLCanvasElement | null
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (blob) download(`block-${stamp()}.png`, blob, 'image/png')
  }, 'image/png')
}

export function Toolbar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const mode = useStore((s) => s.params.renderMode)
  const set = useStore((s) => s.set)
  const fitView = useStore((s) => s.fitView)

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
      <h1>Apartment block generator</h1>
      <span className="spacer" />
      <div className="segmented" role="group" aria-label="Render mode">
        {MODES.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === mode}
            onClick={() => set({ renderMode: o.value })}
          >
            {o.label}
          </button>
        ))}
      </div>
      <button className="ghost" onClick={fitView} title="Frame the whole building">
        Fit
      </button>
      <button className="ghost" onClick={saveImage} title="Save the viewport as a PNG">
        ⤓<span className="label"> Image</span>
      </button>
    </div>
  )
}
