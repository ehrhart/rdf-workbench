export function buildExcerpt(text: string, word: string, radius = 40): string {
  if (!text) return ''
  if (!word) return text.slice(0, 160)

  const lowerText = text.toLowerCase()
  const index = lowerText.indexOf(word.toLowerCase())
  if (index === -1) return text.slice(0, 160)

  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + word.length + radius)
  const matchEnd = index + word.length

  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  const core =
    text.slice(start, index) +
    `<b>${text.slice(index, matchEnd)}</b>` +
    text.slice(matchEnd, end)

  return `${prefix}${core}${suffix}`
}
