'use client'

import {
  ArrowUpRightIcon,
  BracesIcon,
  ClockIcon,
  DatabaseIcon,
  DownloadIcon,
  NetworkIcon,
  UploadIcon
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { queryHistoryService } from '@/lib/client/query-history'
import type { TriplestoreProvider } from '@/lib/runtime/contracts'
import type { EndpointStats } from '@/types'

interface StatsCardsProps {
  stats: EndpointStats
  provider: TriplestoreProvider
}

export function StatsCards({ stats, provider }: StatsCardsProps) {
  const [recentQueriesCount, setRecentQueriesCount] = useState(0)

  useEffect(() => {
    const history = queryHistoryService.getAll()
    setRecentQueriesCount(history.length)
  }, [])

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'queryHistory') {
        const history = queryHistoryService.getAll()
        setRecentQueriesCount(history.length)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="bg-card/50 group hover:bg-card/80 transition-all duration-200 hover:shadow-lg border-2 hover:border-primary/20 gap-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Total Triples
          </CardTitle>
          <div className="rounded-lg bg-primary/10 p-2 group-hover:bg-primary/20 transition-colors">
            <DatabaseIcon className="text-primary h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-bold tracking-tight">
            {stats.totalTriples.toLocaleString()}
          </div>
          <p className="text-muted-foreground text-xs">Across all graphs</p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {provider === 'virtuoso' && (
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href="/import">
                  <UploadIcon />
                  Import Data
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href="/graphs">
                <DownloadIcon />
                {provider === 'virtuoso' ? 'Export Data' : 'Browse Data'}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 group hover:bg-card/80 transition-all duration-200 hover:shadow-lg border-2 hover:border-chart-2/20 gap-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Named Graphs
          </CardTitle>
          <div className="rounded-lg bg-chart-2/10 p-2 group-hover:bg-chart-2/20 transition-colors">
            <NetworkIcon className="text-chart-2 h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-bold tracking-tight">
            {stats.namedGraphs.toLocaleString()}
          </div>
          <p className="text-muted-foreground text-xs">
            Active named graphs in database
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href="/graphs">
                View graphs
                <ArrowUpRightIcon />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 group hover:bg-card/80 transition-all duration-200 hover:shadow-lg border-2 hover:border-chart-4/20 gap-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Recent Queries
          </CardTitle>
          <div className="rounded-lg bg-chart-4/10 p-2 group-hover:bg-chart-4/20 transition-colors">
            <ClockIcon className="text-chart-4 h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-bold tracking-tight">
            {recentQueriesCount.toLocaleString()}
          </div>
          <p className="text-muted-foreground text-xs">
            Total queries in history
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href="/sparql">
                <BracesIcon />
                Run queries
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
