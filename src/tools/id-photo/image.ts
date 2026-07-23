export const ID_PHOTO_WIDTH = 295
export const ID_PHOTO_HEIGHT = 413
export const ID_PHOTO_DPI = 300

export type PhotoOutputMode = 'target-size' | 'quality'

export interface PhotoEncodingOptions {
  mode: PhotoOutputMode
  targetKilobytes: number
  qualityPercent: number
}

export interface EncodedPhoto {
  blob: Blob
  quality: number
  targetReached: boolean
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('JPEG encoding failed.'))
    }, 'image/jpeg', quality)
  })
}

/**
 * Canvas JPEG exports normally omit a useful print-density value. Patch the
 * standard JFIF APP0 density fields so photo software reads the file as 300 DPI.
 */
async function withJfifDensity(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  for (let index = 2; index + 17 < bytes.length;) {
    if (bytes[index] !== 0xff) break
    const marker = bytes[index + 1]
    if (marker === 0xda || marker === 0xd9) break
    const segmentLength = (bytes[index + 2] << 8) | bytes[index + 3]
    if (marker === 0xe0 && segmentLength >= 16 && String.fromCharCode(...bytes.slice(index + 4, index + 9)) === 'JFIF\0') {
      bytes[index + 11] = 1
      bytes[index + 12] = (dpi >> 8) & 0xff
      bytes[index + 13] = dpi & 0xff
      bytes[index + 14] = (dpi >> 8) & 0xff
      bytes[index + 15] = dpi & 0xff
      return new Blob([bytes], { type: 'image/jpeg' })
    }
    if (segmentLength < 2) break
    index += 2 + segmentLength
  }
  return blob
}

async function encodeAtQuality(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return withJfifDensity(await canvasToJpeg(canvas, quality), ID_PHOTO_DPI)
}

/**
 * Encodes at the highest JPEG quality that stays below the requested size.
 * JPEG output cannot be padded safely, so small/simple photos may remain below
 * the requested value; `targetReached` reports when even minimum quality is too large.
 */
export async function encodePhoto(canvas: HTMLCanvasElement, options: PhotoEncodingOptions): Promise<EncodedPhoto> {
  if (options.mode === 'quality') {
    const quality = Math.min(0.95, Math.max(0.05, options.qualityPercent / 100))
    return { blob: await encodeAtQuality(canvas, quality), quality, targetReached: true }
  }

  if (options.targetKilobytes <= 0) {
    const quality = 0.92
    return { blob: await encodeAtQuality(canvas, quality), quality, targetReached: true }
  }

  const targetBytes = options.targetKilobytes * 1024
  let low = 0.05
  let high = 0.95
  let bestQuality = low
  let bestBlob = await encodeAtQuality(canvas, low)
  const targetReached = bestBlob.size <= targetBytes

  if (!targetReached) return { blob: bestBlob, quality: bestQuality, targetReached: false }

  for (let iteration = 0; iteration < 9; iteration += 1) {
    const quality = (low + high) / 2
    const candidate = await encodeAtQuality(canvas, quality)
    if (candidate.size <= targetBytes) {
      bestBlob = candidate
      bestQuality = quality
      low = quality
    } else {
      high = quality
    }
  }

  return { blob: bestBlob, quality: bestQuality, targetReached: true }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(bytes < 1024 * 100 ? 1 : 0)} KB`
}
