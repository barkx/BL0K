import { useEffect, useMemo } from 'react'
import { useStore } from '../store/store'
import { buildContext, disposeContext } from '../geo/build'
import type { MaterialSet } from './materials'

/**
 * Imported OpenStreetMap surroundings.
 *
 * Deliberately inert: no pointer handlers, no selection, nothing draggable. It
 * is scenery to trace a plot over and to judge a massing against, and it takes
 * no part in metrics, clash detection or any export — it is not in
 * `build.placed`, so it cannot.
 *
 * Rebuilt only when the data or the anchor changes, which means turning true
 * north swings the surroundings and nothing else touches them.
 */
export function OsmContext({ mat }: { mat: MaterialSet }) {
  const context = useStore((s) => s.site.context)
  const geo = useStore((s) => s.site.geo)

  const built = useMemo(() => buildContext(context, geo), [context, geo])
  useEffect(() => () => disposeContext(built), [built])

  if (!built.solids && !built.lines) return null

  return (
    <group>
      {built.solids && (
        <mesh geometry={built.solids} material={mat.context} receiveShadow={mat.shadows} />
      )}
      {built.lines && <lineSegments geometry={built.lines} material={mat.contextLine} />}
    </group>
  )
}
