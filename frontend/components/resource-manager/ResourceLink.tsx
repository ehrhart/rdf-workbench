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

  return (
    <span className="literal" title={value}>
      {`"${value}"`}{' '}
      {datatype && (
        <span className="text-muted-foreground text-xs">{`^^${datatype}`}</span>
      )}
      {language && (
        <span className="text-muted-foreground text-xs">{`@${language}`}</span>
      )}
    </span>
  )
})
