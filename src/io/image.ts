/**
 * Bringing a site plan or map screenshot into the app.
 *
 * The image is stored in the site config as a data URL so a saved scheme is
 * self-contained — hand someone the JSON and they get the underlay with it.
 * That makes size a real concern, so anything large is downscaled before it is
 * encoded. Linework and map text survive PNG far better than JPEG, so PNG is
 * tried first and JPEG is the fallback only when PNG comes out too big.
 */

/** Longest edge kept, in pixels. Beyond this the detail is not usable anyway. */
const MAX_EDGE = 2048
/** Above this, re-encode as JPEG rather than carry the PNG. */
const PNG_BUDGET = 6 * 1024 * 1024
/** Refuse anything past this, rather than produce an unusable config. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024

export interface LoadedImage {
  src: string
  name: string
  /** height / width of the pixels, so the ground quad keeps its proportions. */
  aspect: number
  bytes: number
  /** True when the pixels were reduced or re-encoded. */
  reduced: boolean
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.readAsDataURL(file)
  })

const decode = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file is not an image this browser can read'))
    img.src = src
  })

/** Rough byte count of a data URL, without allocating the buffer. */
const dataUrlBytes = (src: string) => {
  const comma = src.indexOf(',')
  const body = comma >= 0 ? src.length - comma - 1 : src.length
  return Math.round(body * 0.75)
}

export async function loadUnderlayImage(file: File): Promise<LoadedImage> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please use one under ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
    )
  }

  const original = await readAsDataUrl(file)
  const img = await decode(original)
  const aspect = img.naturalHeight / img.naturalWidth
  const longest = Math.max(img.naturalWidth, img.naturalHeight)

  if (longest <= MAX_EDGE && dataUrlBytes(original) <= PNG_BUDGET) {
    return { src: original, name: file.name, aspect, bytes: dataUrlBytes(original), reduced: false }
  }

  const ratio = Math.min(1, MAX_EDGE / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser would not give us a canvas to resize with')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  let src = canvas.toDataURL('image/png')
  if (dataUrlBytes(src) > PNG_BUDGET) src = canvas.toDataURL('image/jpeg', 0.85)

  return { src, name: file.name, aspect, bytes: dataUrlBytes(src), reduced: true }
}

export const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} kB`
