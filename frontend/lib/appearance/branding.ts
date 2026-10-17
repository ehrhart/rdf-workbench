const MAX_LOGO_BYTES = 256 * 1024

const DATA_URL_PATTERN =
  /^data:image\/(png|jpeg|webp|svg\+xml)(?:;charset=utf-?8)?;base64,([A-Za-z0-9+/]+={0,2})$/i

// Only http(s) hrefs are rejected; fragment-only refs (#target) stay in the
// document, so they are fine.
const EXTERNAL_REF_PATTERN =
  /(?:^|[\s<])(?:xlink:)?href\s*=\s*["']\s*https?:\/\//i

export interface ParsedImageDataUrl {
  mime: string
  data: string
}

function isPng(bytes: Buffer): boolean {
  return bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
}

function isJpeg(bytes: Buffer): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

function isWebp(bytes: Buffer): boolean {
  return (
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  )
}

function validateSvg(bytes: Buffer): void {
  const text = bytes.toString('utf8')
  if (!/<svg[\s/>]/.test(text)) {
    throw new Error('Logo SVG must contain an <svg> element')
  }
  if (
    /<script/i.test(text) ||
    /foreignObject/i.test(text) ||
    EXTERNAL_REF_PATTERN.test(text)
  ) {
    throw new Error(
      'Logo SVG must not contain scripts, foreignObject, or external references'
    )
  }
}

/**
 * Accepts only data URLs of the four allowed image types and verifies the
 * declared type against the actual bytes — the client controls the declared
 * MIME, so magic bytes are the trustworthy signal.
 */
export function parseImageDataUrl(dataUrl: string): ParsedImageDataUrl {
  const match = DATA_URL_PATTERN.exec(dataUrl.trim())
  if (!match) {
    throw new Error('Logo must be a PNG, JPEG, WEBP, or SVG image')
  }
  const [, subtype, data] = match
  const mime = `image/${subtype.toLowerCase()}`
  const bytes = Buffer.from(data, 'base64')
  if (bytes.length > MAX_LOGO_BYTES) {
    throw new Error('Logo must be under 256 KB')
  }
  if (mime === 'image/svg+xml') {
    validateSvg(bytes)
    return { mime, data }
  }
  const matchesMagic =
    mime === 'image/png'
      ? isPng(bytes)
      : mime === 'image/jpeg'
        ? isJpeg(bytes)
        : isWebp(bytes)
  if (!matchesMagic) {
    throw new Error(
      `Logo file does not look like a valid ${subtype.toUpperCase()}`
    )
  }
  return { mime, data }
}
