import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { m2 } from '../lib/units'
import { captureViewport } from './thumbnail'

/**
 * Design options, as one button in the top bar.
 *
 * The bar was deliberately bare, and this is the one thing that earns a place
 * on it: which scheme you are looking at is true of the whole window, not of
 * any panel, and a tool whose stated job is comparing options should say which
 * one is on screen without being asked.
 *
 * One button rather than a row of tabs — options are a handful, not a workspace,
 * and a row would grow until it needed scrolling and then need a menu anyway.
 */
export function OptionsMenu() {
  const options = useStore((s) => s.options)
  const activeId = useStore((s) => s.activeOption)
  const gfa = useStore((s) => s.build.metrics.gfa)
  const switchOption = useStore((s) => s.switchOption)
  const duplicateOption = useStore((s) => s.duplicateOption)
  const addOption = useStore((s) => s.addOption)
  const removeOption = useStore((s) => s.removeOption)
  const renameOption = useStore((s) => s.renameOption)
  const setOptionThumbnail = useStore((s) => s.setOptionThumbnail)

  /**
   * Take a picture once the scene has actually drawn the new option.
   *
   * Two frames: the first lets React commit the rebuilt geometry, the second
   * lets R3F render it. Capturing sooner gives a picture of the option you just
   * left, which is worse than no picture at all.
   */
  const captureAfterRender = (id: string) => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setOptionThumbnail(id, captureViewport())),
    )
  }

  /**
   * Leave one option and arrive at another, photographing both.
   *
   * Both from the same camera, because switching does not move it — which is
   * what makes the two pictures worth putting side by side.
   */
  const goTo = (id: string) => {
    setOptionThumbnail(activeId, captureViewport())
    switchOption(id)
    captureAfterRender(id)
    setOpen(false)
  }

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const active = options.find((o) => o.id === activeId)

  // Close on a click elsewhere or on Escape, the way every menu should.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="options" ref={box}>
      <button
        className="ghost option-button"
        onClick={() => {
          // Opening refreshes the picture of what is on screen, so the one you
          // are looking at is never the stale one in the list.
          if (!open) setOptionThumbnail(activeId, captureViewport())
          setOpen(!open)
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Design options"
      >
        <span className="option-name">{active?.name ?? 'Option'}</span>
        {options.length > 1 && (
          <span className="option-count">
            {options.findIndex((o) => o.id === activeId) + 1} of {options.length}
          </span>
        )}
        <span className="option-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="option-menu" role="menu">
          {options.map((o) => (
            <div key={o.id} className={o.id === activeId ? 'option-row current' : 'option-row'}>
              {editing === o.id ? (
                <input
                  className="text"
                  autoFocus
                  defaultValue={o.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim()
                    if (name) renameOption(o.id, name)
                    setEditing(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
              ) : (
                <>
                  <button
                    className="option-pick"
                    role="menuitem"
                    onClick={() => (o.id === activeId ? setOpen(false) : goTo(o.id))}
                  >
                    {o.thumbnail ? (
                      <img className="option-thumb" src={o.thumbnail} alt="" />
                    ) : (
                      <span className="option-thumb empty" aria-hidden />
                    )}
                    <span className="option-text">
                      <span className="option-label">{o.name}</span>
                      {/* Only the live option can show a figure: the others hold
                          a site, not a build, and deriving every one to fill a
                          menu would rebuild the whole scheme on hover. */}
                      {o.id === activeId && <span className="option-meta">{m2(gfa)}</span>}
                    </span>
                  </button>
                  <button
                    className="option-edit"
                    title={`Rename ${o.name}`}
                    onClick={() => setEditing(o.id)}
                  >
                    ✎
                  </button>
                  <button
                    className="option-edit"
                    title={`Delete ${o.name}`}
                    disabled={options.length < 2}
                    onClick={() => removeOption(o.id)}
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          ))}

          <div className="option-actions">
            <button
              onClick={() => {
                setOptionThumbnail(activeId, captureViewport())
                duplicateOption()
                setOpen(false)
              }}
            >
              Duplicate this one
            </button>
            <button
              onClick={() => {
                setOptionThumbnail(activeId, captureViewport())
                addOption()
                // The new one is a different scheme, so it needs its own
                // picture once the scene has drawn it.
                requestAnimationFrame(() =>
                  requestAnimationFrame(() =>
                    setOptionThumbnail(useStore.getState().activeOption, captureViewport()),
                  ),
                )
                setOpen(false)
              }}
            >
              Start an empty one
            </button>
          </div>
          <div className="option-note">
            Each option is a whole site, with its own undo. Pictures are taken
            from whatever view is on screen, so two options seen one after the
            other line up.
          </div>
        </div>
      )}
    </div>
  )
}
