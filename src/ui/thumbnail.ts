/**
 * A small picture of the viewport, for telling design options apart.
 *
 * Reaches for the canvas by selector rather than through a ref, exactly as the
 * PNG snapshot does: the canvas belongs to R3F inside `<Scene>`, and threading
 * a ref up through the app to serve a thumbnail would be more coupling than the
 * thumbnail is worth.
 *
 * Readable at any time because the `<Canvas>` is created with
 * `preserveDrawingBuffer: true` — without it WebGL is free to discard the
 * buffer after presenting, and this would come back blank on some machines and
 * not others.
 */

/** Wide enough to tell two massing schemes apart, small enough to be free. */
const WIDTH = 168

/**
 * The viewport as it stands, or null when there is nothing to read.
 *
 * Captured from whatever camera is live, and deliberately so: switching option
 * never moves the camera, so taking one of the option being left *and* one of
 * the option arrived at means both were taken from the same place. Flick
 * between two schemes and their pictures line up; orbit, and the next visit
 * refreshes them.
 */
export function captureViewport(): string | null {
  const canvas = document.querySelector('.viewport canvas') as HTMLCanvasElement | null
  if (!canvas || canvas.width === 0 || canvas.height === 0) return null

  const height = Math.max(1, Math.round((WIDTH * canvas.height) / canvas.width))
  const small = document.createElement('canvas')
  small.width = WIDTH
  small.height = height
  const ctx = small.getContext('2d')
  if (!ctx) return null

  try {
    ctx.drawImage(canvas, 0, 0, WIDTH, height)
    // WebP where it is understood, PNG where it is not — `toDataURL` falls back
    // on its own, and a slightly larger thumbnail is not worth branching for.
    return small.toDataURL('image/webp', 0.7)
  } catch {
    // A tainted or lost context is not worth failing a switch over.
    return null
  }
}
