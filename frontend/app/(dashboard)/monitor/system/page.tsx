import type { Metadata } from 'next'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { getWorkbenchRuntime } from '@/lib/runtime'
import VirtuosoSystemMonitor from './virtuoso-system-monitor'

export const metadata: Metadata = {
  title: 'Endpoint Monitoring',
  description: 'Runtime information for the configured RDF endpoint'
}

function label(value: string): string {
  return value
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function KeyValueTable({
  values
}: {
  values: Record<string, string | number | boolean | null>
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Setting</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(values).map(([key, value]) => (
          <TableRow key={key}>
            <TableCell className="font-medium">{label(key)}</TableCell>
            <TableCell className="font-mono text-xs">
              {value === null ? '—' : String(value)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

async function QleverSystemMonitor() {
  const overview = await (await getWorkbenchRuntime()).getEndpointOverview()
  return (
    <DashboardShell>
      <DashboardHeader heading="QLever Endpoint" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{overview.name}</CardTitle>
            <CardDescription>
              Endpoint status: {overview.healthy ? 'healthy' : 'unavailable'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <KeyValueTable values={overview.stats} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Runtime Settings</CardTitle>
            <CardDescription>
              Public settings reported by the QLever server
            </CardDescription>
          </CardHeader>
          <CardContent>
            <KeyValueTable values={overview.settings ?? {}} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}

export default async function SystemMonitorPage() {
  const runtime = await getWorkbenchRuntime()
  return runtime.provider === 'qlever' ? (
    <QleverSystemMonitor />
  ) : (
    <VirtuosoSystemMonitor />
  )
}
