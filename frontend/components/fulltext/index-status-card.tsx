'use client'

import { RefreshCw, Settings2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  getFTIndexStatus,
  rebuildFTIndex,
  setFTBatchMode
} from '@/providers/virtuoso/fulltext'
import type { FTIndexStatus } from '@/types'

export function IndexStatusCard() {
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [status, setStatus] = useState<FTIndexStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Config form state
  const [selectedMode, setSelectedMode] = useState<'manual' | 'auto' | 'off'>(
    'manual'
  )
  const [intervalMinutes, setIntervalMinutes] = useState<number>(10)

  const loadStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const indexStatus = await getFTIndexStatus()
      setStatus(indexStatus)
    } catch (error) {
      console.error('Failed to load FT index status:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (status) {
      setSelectedMode(status.batchMode)
      setIntervalMinutes(status.interval || 10)
    }
  }, [status])

  const handleRebuild = async () => {
    setIsRebuilding(true)
    setDialogOpen(false)
    try {
      await rebuildFTIndex()
      toast.success(
        'Full-text index rebuild initiated. This may take some time for large datasets.'
      )
    } catch (error) {
      console.error('Failed to rebuild FT index:', error)
      toast.error('Failed to rebuild full-text index.')
    } finally {
      setIsRebuilding(false)
    }
  }

  const handleSaveConfig = async () => {
    setIsSaving(true)
    try {
      await setFTBatchMode(
        selectedMode,
        selectedMode === 'auto' ? intervalMinutes : undefined
      )

      await loadStatus() // Reload to confirm changes
      setConfigDialogOpen(false)

      toast.success('Batch mode configuration updated successfully.')
    } catch (error) {
      console.error('Failed to update batch mode:', error)
      toast.error('Failed to update batch mode configuration.')
    } finally {
      setIsSaving(false)
    }
  }

  const getBadgeVariant = (mode: string) => {
    switch (mode) {
      case 'auto':
        return 'default'
      case 'off':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getModeLabel = (mode: string, interval?: number) => {
    switch (mode) {
      case 'auto':
        return `Auto (${interval} min)`
      case 'off':
        return 'Real-time'
      default:
        return 'Manual'
    }
  }

  const getModeDescription = (mode: string) => {
    switch (mode) {
      case 'auto':
        return 'Index updates automatically at scheduled intervals.'
      case 'off':
        return 'Index updates in real-time with each change (not recommended for production).'
      default:
        return 'Index updates must be triggered manually. Use the rebuild button after adding rules or importing data.'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Index Status & Maintenance</CardTitle>
        <CardDescription>
          Manage full-text index updates and batch processing mode
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Batch Update Mode:</span>
              {isLoading ? (
                <Badge variant="outline">Loading...</Badge>
              ) : status ? (
                <Badge variant={getBadgeVariant(status.batchMode)}>
                  {getModeLabel(status.batchMode, status.interval)}
                </Badge>
              ) : (
                <Badge variant="secondary">Unknown</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {status
                ? getModeDescription(status.batchMode)
                : 'Unable to determine index status.'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={isRebuilding}>
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isRebuilding ? 'animate-spin' : ''}`}
                />
                {isRebuilding ? 'Rebuilding...' : 'Rebuild Index'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rebuild Full-Text Index?</DialogTitle>
                <DialogDescription>
                  This will synchronize the full-text index with the current RDF
                  data based on active indexing rules. This operation may take
                  several minutes for large datasets.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRebuild}>Rebuild</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings2 className="mr-2 h-4 w-4" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure Batch Update Mode</DialogTitle>
                <DialogDescription>
                  Choose how the full-text index is updated when RDF data
                  changes.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="mode">Update Mode</Label>
                  <Select
                    value={selectedMode}
                    onValueChange={(value) =>
                      setSelectedMode(value as 'manual' | 'auto' | 'off')
                    }
                  >
                    <SelectTrigger id="mode">
                      <SelectValue placeholder="Select update mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="auto">Automatic</SelectItem>
                      <SelectItem value="off">Real-time</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {selectedMode === 'manual' &&
                      'Rebuild index manually after changes'}
                    {selectedMode === 'auto' &&
                      'Index updates automatically at intervals'}
                    {selectedMode === 'off' &&
                      'Index updates immediately (performance impact)'}
                  </p>
                </div>

                {selectedMode === 'auto' && (
                  <div className="space-y-2">
                    <Label htmlFor="interval">Update Interval (minutes)</Label>
                    <Input
                      id="interval"
                      type="number"
                      min="1"
                      value={intervalMinutes}
                      onChange={(e) =>
                        setIntervalMinutes(parseInt(e.target.value, 10) || 10)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      How often the index should be updated automatically
                    </p>
                  </div>
                )}

                {selectedMode === 'off' && (
                  <Alert>
                    <AlertDescription>
                      <strong>Warning:</strong> Real-time mode can significantly
                      impact performance, especially with frequent data changes.
                      Recommended only for development or small datasets.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setConfigDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveConfig} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
