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

interface SystemStats {
  [key: string]: string | number | null
}

// System statistics to fetch, organized by category
const systemVariables = {
  general: [
    'st_dbms_name',
    'st_dbms_ver',
    'st_build_date',
    'st_build_thread_model',
    'st_build_opsys_id',
    'st_host_name',
    'st_cpu_count',
    'db_ver_string',
    'git_head'
  ],
  database: [
    'st_db_file_size',
    'st_db_pages',
    'st_db_page_size',
    'st_db_free_pages',
    'db_default_columnstore',
    'db_exists',
    'st_lite_mode'
  ],
  memory: [
    'st_db_buffers',
    'st_db_used_buffers',
    'st_db_dirty_buffers',
    'st_db_wired_buffers',
    'st_sys_ram',
    'mp_large_in_use',
    'mp_max_large_in_use',
    'mp_mmap_clocks'
  ],
  performance: [
    'disk_reads',
    'disk_writess',
    'read_cum_time',
    'write_cum_time',
    'st_db_disk_read_avg',
    'st_db_disk_read_pct',
    'st_inx_pages_changed',
    'st_inx_pages_new'
  ],
  locks: ['lock_deadlocks', 'lock_waits', 'lock_enters', 'lock_leaves'],
  processes: [
    'st_proc_served',
    'st_proc_active',
    'st_proc_running',
    'st_proc_queued_req',
    'thr_thread_num_total',
    'thr_thread_num_wait',
    'thr_cli_running',
    'thr_cli_waiting'
  ],
  connections: [
    'st_cli_connects',
    'st_cli_max_connected',
    'st_cli_n_current_connections',
    'st_cli_n_http_threads',
    'tws_connections',
    'tws_requests',
    'tws_max_connects'
  ],
  rdf: [
    'enable_rdf_box_const',
    'rdf_rpid64_mode',
    'disable_rdf_init',
    'enable_rdf_trig'
  ]
}

const allVariables = Object.values(systemVariables).flat()

export default function SystemPage() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSystemStats = async (): Promise<void> => {
      try {
        setLoading(true)
        const result = await sysStat(allVariables)
        setStats(result)
      } catch (err) {
        console.error('Error fetching system stats:', err)
        setError('Failed to fetch system statistics')
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
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardHeader heading="System Monitoring">
        <div className="text-muted-foreground text-sm">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </DashboardHeader>
      <div className="space-y-4">
        {/* System Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
            <CardDescription>
              General information about the Virtuoso server
            </CardDescription>
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
                <p className="text-sm font-medium">Database Size</p>
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
            <CardTitle>Memory Usage</CardTitle>
            <CardDescription>Database buffer utilization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Buffer Usage</span>
                  <span className="text-muted-foreground text-sm">
                    {stats?.st_db_used_buffers || 0} /{' '}
                    {stats?.st_db_buffers || 0} buffers
                  </span>
                </div>
                <Progress value={getMemoryUsagePercentage()} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-sm font-medium">Total Buffers</p>
                  <p className="text-xl font-semibold">
                    {stats?.st_db_buffers || 0}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-sm font-medium">Used Buffers</p>
                  <p className="text-xl font-semibold">
                    {stats?.st_db_used_buffers || 0}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-sm font-medium">Dirty Buffers</p>
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
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>
              Key database operations and their counts
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
                <CardTitle>Database Information</CardTitle>
                <CardDescription>
                  Details about the database configuration
                </CardDescription>
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
                <CardTitle>Process Information</CardTitle>
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
                <CardTitle>Connection Statistics</CardTitle>
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
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>
                  Detailed performance statistics
                </CardDescription>
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
                <CardTitle>Lock Statistics</CardTitle>
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
                <CardTitle>Memory Statistics</CardTitle>
                <CardDescription>
                  Detailed memory usage information
                </CardDescription>
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
                <CardTitle>RDF Configuration</CardTitle>
                <CardDescription>
                  RDF and SPARQL related settings
                </CardDescription>
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
