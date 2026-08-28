import { Fragment, memo } from 'react'
import type { ResourceInfo } from './types'

export const ResourceHeader = memo(function ResourceHeader({
  resourceInfo
}: {
  resourceInfo: ResourceInfo | null
}) {
  if (!resourceInfo) return null

  const { uri, label, comment, type = [] } = resourceInfo
  const displayLabel = label || uri

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold">
        <a
          href={uri}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all hover:underline"
        >
          {displayLabel}
        </a>
      </h1>
      {comment && <p className="text-gray-600">{comment}</p>}
      <p>
        <span className="font-semibold">Source:</span>&nbsp;
        <a
          href={uri}
          className="break-all text-blue-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {uri}
        </a>
      </p>
      {type.length > 0 && (
        <p>
          <span className="font-semibold">Type:</span>&nbsp;
          {type.map((t, idx) => (
            <Fragment key={t}>
              <a
                href={`/resource?uri=${encodeURIComponent(t)}`}
                className="text-blue-600 hover:underline"
              >
                {t}
              </a>
              {idx < type.length - 1 ? ', ' : ''}
            </Fragment>
          ))}
        </p>
      )}
    </div>
  )
})
