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
      toast.success('Rebuild started', {
        description: 'This can take a while on large datasets.'
      })
    } catch (error) {
      console.error('Failed to rebuild FT index:', error)
      toast.error("Couldn't rebuild the index.")
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

      toast.success('Batch mode updated')
    } catch (error) {
      console.error('Failed to update batch mode:', error)
      toast.error("Couldn't update batch mode.")
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
        return 'The index updates on a schedule.'
      case 'off':
        return 'The index updates in real time with every change. Not recommended for production.'
      default:
        return 'The index updates only when you rebuild it. Rebuild after adding rules or importing data.'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Index status</CardTitle>
        <CardDescription>
          How the index stays current with the dataset.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Batch update mode</span>
              {isLoading ? (
                <Badge variant="outline">Loading status…</Badge>
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
                : "Couldn't load the index status."}
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
                {isRebuilding ? 'Rebuilding…' : 'Rebuild index'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rebuild the full-text index?</DialogTitle>
                <DialogDescription>
                  The index is rebuilt from the current data following the
                  active rules. This can take several minutes on large datasets.
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
                <DialogTitle>Configure batch update mode</DialogTitle>
                <DialogDescription>
                  Choose how the full-text index is updated when RDF data
                  changes.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="mode">Update mode</Label>
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
                    {selectedMode === 'manual' && 'Rebuild after changes.'}
                    {selectedMode === 'auto' &&
                      'The index updates on a schedule.'}
                    {selectedMode === 'off' &&
                      'The index updates with every change, at a performance cost.'}
                  </p>
                </div>

                {selectedMode === 'auto' && (
                  <div className="space-y-2">
                    <Label htmlFor="interval">Update interval (minutes)</Label>
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
                      How often the index updates.
                    </p>
                  </div>
                )}

                {selectedMode === 'off' && (
                  <Alert>
                    <AlertDescription>
                      <strong>Warning:</strong> Real-time updates slow down
                      every write. Use them only in development or for small
                      datasets.
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
                  {isSaving ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
