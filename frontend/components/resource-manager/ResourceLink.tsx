import { memo } from 'react'
import type { RDFNode } from './types'

export const ResourceLink = memo(function ResourceLink({
  node
}: {
  node: RDFNode
}) {
  const { value, type, datatype, language } = node

  if (type === 'uri') {
    return (
      <a
        href={`/resource?uri=${encodeURIComponent(value)}`}
        title={value}
        className="text-blue-600 hover:underline"
      >
        {value}
      </a>
    )
  }

  if (type === 'bnode') {
    return <span className="text-gray-500 italic">{value}</span>
  }

  let suffix = ''
  if (datatype) {
    suffix = ` (^^${datatype})`
  } else if (language) {
    suffix = ` @${language}`
  }

  return (
    <span className="literal" title={value}>
      {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      {`"${value}"`}
    </span>
  )
})
