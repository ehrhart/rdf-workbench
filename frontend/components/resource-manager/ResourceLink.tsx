import { memo } from 'react'
import type { RDFNode } from './types'

/**
 * Renders an RDF resource (URI, Literal, or Blank Node) with appropriate links/styling
 */
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
    // Basic blank node display
    return <span className="text-gray-500 italic">{value}</span>
  }

  // Literal
  const displayValue = value
  let suffix = ''
  if (datatype) {
    suffix = ` (^^${datatype})`
  } else if (language) {
    suffix = ` @${language}`
  }

  const truncatedValue =
    displayValue.length > 50
      ? `"${displayValue.substring(0, 50)}..."`
      : `"${displayValue}"`

  return (
    <span className="literal" title={value}>
      {truncatedValue}
      {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
    </span>
  )
})
