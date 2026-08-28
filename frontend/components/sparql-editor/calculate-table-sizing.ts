import type { Header } from '@tanstack/react-table'

const DEFAULT_MIN_SIZE = 80

const clampSize = (
  size: number | undefined,
  min?: number,
  max?: number
): number => {
  const lowerBound =
    typeof min === 'number' && Number.isFinite(min) ? min : DEFAULT_MIN_SIZE
  const upperBound =
    typeof max === 'number' && Number.isFinite(max)
      ? max
      : Number.MAX_SAFE_INTEGER

  const candidate =
    typeof size === 'number' && Number.isFinite(size) ? size : lowerBound

  return Math.min(Math.max(candidate, lowerBound), upperBound)
}

export const calculateTableSizing = <TData>(
  headers: Header<TData, unknown>[],
  totalWidth: number
): Record<string, number> => {
  if (headers.length === 0) {
    return {}
  }

  const fallbackTotalWidth = headers.reduce((accumulator, header) => {
    const columnDef = header.column.columnDef
    return (
      accumulator +
      clampSize(
        typeof columnDef.size === 'number' ? columnDef.size : undefined,
        columnDef.minSize,
        columnDef.maxSize
      )
    )
  }, 0)

  const safeTotalWidth =
    Number.isFinite(totalWidth) && totalWidth > 0
      ? totalWidth
      : fallbackTotalWidth

  let availableWidth = safeTotalWidth
  const growHeaders: Header<TData, unknown>[] = []
  const computedSizes = new Map<string, number>()

  for (const header of headers) {
    const columnDef = header.column.columnDef
    const meta = columnDef.meta ?? {}

    if (meta.isGrow) {
      growHeaders.push(header)
      continue
    }

    let candidateSize: number | undefined

    if (meta.widthPercentage) {
      candidateSize = (meta.widthPercentage / 100) * safeTotalWidth
    } else if (typeof columnDef.size === 'number' && columnDef.size > 0) {
      candidateSize = columnDef.size
    }

    const constrainedSize = clampSize(
      candidateSize,
      columnDef.minSize,
      columnDef.maxSize
    )

    computedSizes.set(header.id, constrainedSize)
    availableWidth -= constrainedSize
  }

  if (availableWidth < 0) {
    availableWidth = 0
  }

  const growCount = growHeaders.length

  if (growCount > 0) {
    const chunk = growCount > 0 ? availableWidth / growCount : 0

    for (const header of growHeaders) {
      const columnDef = header.column.columnDef
      const meta = columnDef.meta ?? {}

      let candidateSize: number | undefined

      if (meta.widthPercentage) {
        candidateSize = (meta.widthPercentage / 100) * safeTotalWidth
      } else if (typeof columnDef.size === 'number' && columnDef.size > 0) {
        candidateSize = columnDef.size
      } else if (chunk > 0) {
        candidateSize = chunk
      }

      const constrainedSize = clampSize(
        candidateSize,
        columnDef.minSize,
        columnDef.maxSize
      )

      computedSizes.set(header.id, constrainedSize)
    }
  }

  const result: Record<string, number> = {}
  let computedTotal = 0

  for (const header of headers) {
    const columnDef = header.column.columnDef
    const size = computedSizes.get(header.id)

    const constrainedSize = clampSize(
      size,
      columnDef.minSize,
      columnDef.maxSize
    )

    result[header.id] = constrainedSize
    computedTotal += constrainedSize
  }

  if (computedTotal < safeTotalWidth && growCount === 0 && headers.length > 0) {
    const remainder = safeTotalWidth - computedTotal
    const firstHeader = headers[0]
    const columnDef = firstHeader.column.columnDef
    const currentSize = result[firstHeader.id]

    result[firstHeader.id] = clampSize(
      currentSize + remainder,
      columnDef.minSize,
      columnDef.maxSize
    )
  }

  return result
}
