import { cn } from 'cn'
import RDFIcon from '@/components/rdf-icon'

export function BrandMark({
  version,
  className
}: {
  version?: string | null
  className?: string
}) {
  if (!version) return <RDFIcon className={cn('text-foreground', className)} />
  return (
    // biome-ignore lint/performance/noImgElement: user-uploaded logo served by a dynamic route with a cache-buster; image optimization is disabled app-wide
    <img
      src={`/api/appearance/logo?v=${version}`}
      alt=""
      className={className}
    />
  )
}
