import { memo } from 'react'
import { usePrefixes } from '@/components/prefixes/prefix-context'
import { prefixedIri } from '@/lib/utils'
import type { RDFNode } from './types'

export const ResourceLink = memo(function ResourceLink({
  node
}: {
  node: RDFNode
}) {
  const { value, type, datatype, language } = node
  const prefixes = usePrefixes()

  if (type === 'uri') {
    return (
      <a
        href={`/resource?uri=${encodeURIComponent(value)}`}
        title={value}
        className="text-blue-600 hover:underline"
      >
        {prefixedIri(value, prefixes)}
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
        <span className="text-muted-foreground text-xs">
          {`^^${prefixedIri(datatype, prefixes)}`}
        </span>
      )}
      {language && (
        <span className="text-muted-foreground text-xs">{`@${language}`}</span>
      )}
    </span>
  )
})
