export interface QueryDiffLine {
  sign: 'removed' | 'added'
  text: string
}

/**
 * Line-level diff between two texts, unchanged lines omitted.
 */
export function diffQueryLines(before: string, after: string): QueryDiffLine[] {
  const oldLines = before.split('\n')
  const newLines = after.split('\n')
  const rowCount = oldLines.length
  const columnCount = newLines.length

  // lcs[i][j] = length of the longest common subsequence of oldLines[i..] and newLines[j..]
  const lcs: number[][] = Array.from({ length: rowCount + 1 }, () =>
    new Array<number>(columnCount + 1).fill(0)
  )
  for (let i = rowCount - 1; i >= 0; i -= 1) {
    for (let j = columnCount - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        oldLines[i] === newLines[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const diff: QueryDiffLine[] = []
  let i = 0
  let j = 0
  while (i < rowCount && j < columnCount) {
    if (oldLines[i] === newLines[j]) {
      i += 1
      j += 1
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      diff.push({ sign: 'removed', text: oldLines[i] })
      i += 1
    } else {
      diff.push({ sign: 'added', text: newLines[j] })
      j += 1
    }
  }
  while (i < rowCount) {
    diff.push({ sign: 'removed', text: oldLines[i] })
    i += 1
  }
  while (j < columnCount) {
    diff.push({ sign: 'added', text: newLines[j] })
    j += 1
  }
  return diff
}
