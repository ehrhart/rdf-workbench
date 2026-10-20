'use client'

import { AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatBytes } from '@/lib/utils'
import { sysStat } from './actions'
import { allSystemVariables, systemVariables } from './variables'

interface SystemStats {
  [key: string]: string | number | null
}

export default function SystemPage() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSystemStats = async (): Promise<void> => {
      try {
        setLoading(true)
        const result = await sysStat(allSystemVariables)
        setStats(result)
      } catch (err) {
        console.error('Error fetching system stats:', err)
        setError('Refresh the page to try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchSystemStats()

    const intervalId = setInterval(fetchSystemStats, 30000)

    return () => clearInterval(intervalId)
  }, [])

  // Format values based on their likely type
  const formatValue = (
    key: string,
    value: string | number | null
  ): string | number => {
    if (value === null) return 'N/A'

    // Handle special cases
    if (
      key.includes('_size') ||
      key.includes('_bytes') ||
      key === 'st_db_file_size' ||
      key === 'st_sys_ram'
    ) {
      return formatBytes(Number(value))
    }

    // Return as is for other cases
    return value
  }

  const getPerformanceData = (): { name: string; value: number }[] => {
    if (!stats) return []

    return [
      { name: 'Disk Reads', value: Number(stats.disk_reads) || 0 },
      { name: 'Disk Writes', value: Number(stats.disk_writess) || 0 },
      { name: 'Lock Waits', value: Number(stats.lock_waits) || 0 },
      { name: 'Lock Enters', value: Number(stats.lock_enters) || 0 }
    ]
  }

  const getMemoryUsagePercentage = (): number => {
    if (!stats) return 0

    const used = Number(stats.st_db_used_buffers) || 0
    const total = Number(stats.st_db_buffers) || 1

    return Math.round((used / total) * 100)
  }

  if (loading && !stats) {
    return (
      <DashboardShell>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-2/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    )
  }

  if (error) {
    return (
      <DashboardShell>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn't load system statistics</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardHeader heading="System monitor">
        <div className="text-muted-foreground text-sm">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </DashboardHeader>
      <div className="space-y-4">
        {/* System Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle>System overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm font-medium">Server</p>
                <p className="text-2xl font-bold">
                  {stats?.st_dbms_name || 'Unknown'}
                </p>
                <p className="text-muted-foreground text-sm">
                  {stats?.st_dbms_ver || ''}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Host</p>
                <p className="text-2xl font-bold">
                  {stats?.st_host_name || 'Unknown'}
                </p>
                <p className="text-muted-foreground text-sm">
                  {stats?.st_cpu_count || '0'} CPUs
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Database size</p>
                <p className="text-2xl font-bold">
                  {formatValue('st_db_file_size', stats?.st_db_file_size || 0)}
                </p>
                <p className="text-muted-foreground text-sm">
                  {stats?.st_db_pages || '0'} pages
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Memory Usage Card */}
        <Card>
          <CardHeader>
            <CardTitle>Memory usage</CardTitle>
            <CardDescription>Database buffer utilization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Buffer usage</span>
                  <span className="text-muted-foreground text-sm">
                    {stats?.st_db_used_buffers || 0} /{' '}
                    {stats?.st_db_buffers || 0} buffers
                  </span>
                </div>
                <Progress value={getMemoryUsagePercentage()} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-sm font-medium">Total buffers</p>
                  <p className="text-xl font-semibold">
                    {stats?.st_db_buffers || 0}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-sm font-medium">Used buffers</p>
                  <p className="text-xl font-semibold">
                    {stats?.st_db_used_buffers || 0}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-sm font-medium">Dirty buffers</p>
                  <p className="text-xl font-semibold">
                    {stats?.st_db_dirty_buffers || 0}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-sm font-medium">System RAM</p>
                  <p className="text-xl font-semibold">
                    {formatValue('st_sys_ram', stats?.st_sys_ram || 0)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Performance metrics</CardTitle>
            <CardDescription>
              Counts of key database operations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getPerformanceData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Statistics Tabs */}
        <Tabs defaultValue="database">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="processes">Processes</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="locks">Locks</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="rdf">RDF</TabsTrigger>
          </TabsList>

          {/* Database Tab */}
          <TabsContent value="database">
            <Card>
              <CardHeader>
                <CardTitle>Database information</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parameter</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemVariables.database.map((key) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{key}</TableCell>
                        <TableCell>
                          {formatValue(key, stats?.[key] || null)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Processes Tab */}
          <TabsContent value="processes">
            <Card>
              <CardHeader>
                <CardTitle>Process information</CardTitle>
                <CardDescription>System process statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parameter</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemVariables.processes.map((key) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{key}</TableCell>
                        <TableCell>
                          {formatValue(key, stats?.[key] || null)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connections Tab */}
          <TabsContent value="connections">
            <Card>
              <CardHeader>
                <CardTitle>Connection statistics</CardTitle>
                <CardDescription>Client connection information</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parameter</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemVariables.connections.map((key) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{key}</TableCell>
                        <TableCell>
                          {formatValue(key, stats?.[key] || null)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Performance metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parameter</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemVariables.performance.map((key) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{key}</TableCell>
                        <TableCell>
                          {formatValue(key, stats?.[key] || null)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Locks Tab */}
          <TabsContent value="locks">
            <Card>
              <CardHeader>
                <CardTitle>Lock statistics</CardTitle>
                <CardDescription>Database lock information</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parameter</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemVariables.locks.map((key) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{key}</TableCell>
                        <TableCell>
                          {formatValue(key, stats?.[key] || null)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Memory Tab */}
          <TabsContent value="memory">
            <Card>
              <CardHeader>
                <CardTitle>Memory statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parameter</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemVariables.memory.map((key) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{key}</TableCell>
                        <TableCell>
                          {formatValue(key, stats?.[key] || null)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RDF Tab */}
          <TabsContent value="rdf">
            <Card>
              <CardHeader>
                <CardTitle>RDF configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parameter</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemVariables.rdf.map((key) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{key}</TableCell>
                        <TableCell>
                          {formatValue(key, stats?.[key] || null)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  )
}
