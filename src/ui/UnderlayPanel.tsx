import { useRef, useState } from 'react'
import { useStore } from '../store/store'
import { DEFAULT_UNDERLAY_WIDTH } from '../site/types'
import { formatBytes, loadUnderlayImage } from '../io/image'
import { round } from '../lib/clamp'
import { m } from '../lib/units'

/**
 * The image you trace over: load it, set its true scale from two points a known
 * distance apart, then lock it so it stops intercepting clicks.
 */
export function UnderlayPanel() {
  const underlay = useStore((s) => s.site.underlay)
  const setUnderlay = useStore((s) => s.setUnderlay)
  const updateUnderlay = useStore((s) => s.updateUnderlay)
  const plotMode = useStore((s) => s.plotMode)
  const calibration = useStore((s) => s.calibration)
  const startCalibration = useStore((s) => s.startCalibration)
  const cancelCalibration = useStore((s) => s.cancelCalibration)
  const applyCalibration = useStore((s) => s.applyCalibration)

  const file = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<string | null>(null)
  const [realDistance, setRealDistance] = useState('50')

  const onFile = async (f: File) => {
    setNote(null)
    try {
      const image = await loadUnderlayImage(f)
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
      })
      setNote(
        `${image.name} · ${formatBytes(image.bytes)}` +
          (image.reduced ? ' · downscaled to keep the site file small' : '') +
          '. Now set the scale.',
      )
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'That image could not be loaded.')
    }
  }

  const picker = (
    <input
      ref={file}
      type="file"
      accept="image/*"
      style={{ display: 'none' }}
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) void onFile(f)
        e.target.value = ''
      }}
    />
  )

  if (!underlay) {
    return (
      <>
        <div className="field">
          <div className="hint">
            Drop a map screenshot or site plan onto the viewport, or choose one
            below. Then set its scale and trace the plot over it.
          </div>
        </div>
        <div className="stack">
          <button className="ghost" onClick={() => file.current?.click()}>
            Choose image
          </button>
        </div>
        {note && (
          <div className="field">
            <div className="hint error">{note}</div>
          </div>
        )}
        {picker}
      </>
    )
  }

  if (plotMode === 'calibrate') {
    const measured =
      calibration.length === 2
        ? Math.hypot(
            calibration[1].x - calibration[0].x,
            calibration[1].z - calibration[0].z,
          )
        : 0
    return (
      <>
        <div className="field">
          <div className="hint snap">
            Click two points on the image whose real distance you know — a street
            width, a building edge, a scale bar.
          </div>
          <div className="hint">
            {calibration.length} of 2 marked
            {measured > 0 ? ` · currently ${m(measured)} apart` : ''}
          </div>
        </div>

        {calibration.length === 2 && (
          <div className="field">
            <div className="row">
              <label htmlFor="cal-dist">That distance really is</label>
              <span className="value">
                <input
                  id="cal-dist"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={realDistance}
                  onChange={(e) => setRealDistance(e.target.value)}
                />
                <span className="unit">m</span>
              </span>
            </div>
          </div>
        )}

        <div className="stack">
          <button
            className="ghost"
            disabled={calibration.length < 2 || !(Number(realDistance) > 0)}
            onClick={() => applyCalibration(Number(realDistance))}
          >
            Apply scale
          </button>
          <button className="ghost" onClick={cancelCalibration}>
            Cancel
          </button>
        </div>
        {picker}
      </>
    )
  }

  const height = underlay.width * underlay.aspect

  return (
    <>
      <div className="field">
        <div className="row">
          <label>Image</label>
          <span className="value num" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
            {m(underlay.width)} × {m(height)}
          </span>
        </div>
        <div className="hint">{underlay.name}</div>
      </div>

      <div className="stack">
        <button className="ghost" onClick={startCalibration}>
          Set scale from two points
        </button>
      </div>

      <div className="field">
        <div className="row">
          <label htmlFor="u-width">Width</label>
          <span className="value">
            <input
              id="u-width"
              type="number"
              min={1}
              step={1}
              value={round(underlay.width, 1)}
              onChange={(e) =>
                Number(e.target.value) > 0 && updateUnderlay({ width: Number(e.target.value) })
              }
            />
            <span className="unit">m</span>
          </span>
        </div>
      </div>

      <div className="field">
        <div className="row">
          <label>Position</label>
          <span className="value">
            <input
              type="number"
              step={0.5}
              aria-label="Image X"
              value={round(underlay.position.x, 1)}
              onChange={(e) =>
                Number.isFinite(Number(e.target.value)) &&
                updateUnderlay({ position: { ...underlay.position, x: Number(e.target.value) } })
              }
            />
            <input
              type="number"
              step={0.5}
              aria-label="Image Z"
              value={round(underlay.position.z, 1)}
              onChange={(e) =>
                Number.isFinite(Number(e.target.value)) &&
                updateUnderlay({ position: { ...underlay.position, z: Number(e.target.value) } })
              }
            />
            <span className="unit">m</span>
          </span>
        </div>
        <div className="hint">
          {underlay.locked ? 'Unlock to drag it.' : 'Or drag the image across the ground.'}
        </div>
      </div>

      <div className="field">
        <div className="row">
          <label htmlFor="u-rot">Rotation</label>
          <span className="value">
            <input
              id="u-rot"
              type="number"
              step={0.5}
              value={round(underlay.rotation, 1)}
              onChange={(e) =>
                Number.isFinite(Number(e.target.value)) &&
                updateUnderlay({ rotation: Number(e.target.value) })
              }
            />
            <span className="unit">°</span>
          </span>
        </div>
        <input
          type="range"
          aria-label="Image rotation"
          min={-180}
          max={180}
          step={0.5}
          value={underlay.rotation}
          onChange={(e) => updateUnderlay({ rotation: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <div className="row">
          <label htmlFor="u-op">Opacity</label>
          <span className="value num" style={{ fontSize: 12 }}>
            {Math.round(underlay.opacity * 100)}%
          </span>
        </div>
        <input
          id="u-op"
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={underlay.opacity}
          onChange={(e) => updateUnderlay({ opacity: Number(e.target.value) })}
        />
      </div>

      <div className="stack">
        <div className="pair">
          <button
            className="ghost"
            aria-pressed={underlay.locked}
            onClick={() => updateUnderlay({ locked: !underlay.locked })}
          >
            {underlay.locked ? 'Unlock' : 'Lock'}
          </button>
          <button
            className="ghost"
            aria-pressed={!underlay.visible}
            onClick={() => updateUnderlay({ visible: !underlay.visible })}
          >
            {underlay.visible ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="pair">
          <button className="ghost" onClick={() => file.current?.click()}>
            Replace
          </button>
          <button className="ghost" onClick={() => setUnderlay(null)}>
            Remove
          </button>
        </div>
      </div>

      {note && (
        <div className="field">
          <div className="hint">{note}</div>
        </div>
      )}
      {picker}
    </>
  )
}
