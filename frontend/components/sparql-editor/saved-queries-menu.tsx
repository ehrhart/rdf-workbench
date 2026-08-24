'use client'

import { formatDistanceToNow } from 'date-fns'
import {
  BookMarked,
  BookmarkPlus,
  ExternalLink,
  LinkIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Settings2,
  Trash2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  createSavedQueryClient,
  deleteSavedQueryClient,
  fetchSavedQueries,
  fetchSavedQuery,
  updateSavedQueryClient
} from '@/lib/client/saved-queries'
import type { SavedQuery } from '@/types'
import { CopyToClipboardButton } from '../prefixes/copy-to-clipboard-button'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import { Textarea } from '../ui/textarea'

interface SavedQueriesMenuProps {
  currentUser?: { id: string; username: string; role?: 'admin' | 'user' } | null
  activeTabName: string
  activeQuery: string
  onOpenSavedQuery: (saved: SavedQuery) => void
  onSaved?: (saved: SavedQuery) => void
}

type DialogMode = 'create' | 'edit'

export function SavedQueriesMenu({
  currentUser,
  activeTabName,
  activeQuery,
  onOpenSavedQuery,
  onSaved
}: SavedQueriesMenuProps) {
  const router = useRouter()
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>('create')
  const [draftName, setDraftName] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [editingSavedQuery, setEditingSavedQuery] = useState<SavedQuery | null>(
    null
  )

  const hasQueryToSave = useMemo(
    () => Boolean(activeQuery?.trim()) && Boolean(currentUser),
    [activeQuery, currentUser]
  )

  const isAdmin = currentUser?.role === 'admin'

  const refreshSavedQueries = useCallback(async () => {
    try {
      setIsLoadingList(true)
      const list = await fetchSavedQueries()
      setSavedQueries(list)
    } catch (error) {
      console.error('Failed to load saved queries', error)
      toast.error('Unable to load saved queries right now')
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (!isDropdownOpen) return
    void refreshSavedQueries()
  }, [isDropdownOpen, refreshSavedQueries])

  const openCreateDialog = useCallback(() => {
    if (!currentUser) {
      toast.info('Log in to save queries that everyone can reuse')
      return
    }
    if (!activeQuery.trim()) {
      toast.error('Write a query before saving it')
      return
    }
    setDialogMode('create')
    setEditingSavedQuery(null)
    setDraftName(activeTabName || 'New Query')
    setDraftQuery(activeQuery)
    setIsDialogOpen(true)
  }, [activeQuery, activeTabName, currentUser])

  const openEditDialog = useCallback((saved: SavedQuery) => {
    setDialogMode('edit')
    setEditingSavedQuery(saved)
    setDraftName(saved.name)
    setDraftQuery(saved.query)
    setIsDialogOpen(true)
  }, [])

  const upsertSavedQueryLocally = useCallback((saved: SavedQuery) => {
    setSavedQueries((current) => {
      const existingIndex = current.findIndex((item) => item.id === saved.id)
      if (existingIndex === -1) {
        return [saved, ...current]
      }
      const clone = [...current]
      clone[existingIndex] = saved
      return clone
    })
  }, [])

  const handleDialogSubmit = useCallback(async () => {
    if (!currentUser) {
      toast.error('Authentication required to save queries')
      return
    }

    const trimmedName = draftName.trim()
    const trimmedQuery = draftQuery.trim()

    if (!trimmedName) {
      toast.error('Give your saved query a name')
      return
    }
    if (!trimmedQuery) {
      toast.error('Query cannot be empty')
      return
    }

    setIsSaving(true)
    try {
      if (dialogMode === 'edit' && editingSavedQuery) {
        const updated = await updateSavedQueryClient(editingSavedQuery.id, {
          name: trimmedName,
          query: trimmedQuery
        })
        upsertSavedQueryLocally(updated)
        toast.success('Saved query updated')
        onSaved?.(updated)
      } else {
        const created = await createSavedQueryClient({
          name: trimmedName,
          query: trimmedQuery
        })
        upsertSavedQueryLocally(created)
        toast.success('Saved query created')
        onSaved?.(created)
      }
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Failed to persist saved query', error)
      const message =
        error instanceof Error ? error.message : 'Unable to save query'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }, [
    currentUser,
    dialogMode,
    draftName,
    draftQuery,
    editingSavedQuery,
    onSaved,
    upsertSavedQueryLocally
  ])

  const handleDelete = useCallback(async (saved: SavedQuery) => {
    const confirmed = window.confirm(
      `Delete "${saved.name}" for everyone? This cannot be undone.`
    )
    if (!confirmed) return

    try {
      await deleteSavedQueryClient(saved.id)
      setSavedQueries((current) =>
        current.filter((item) => item.id !== saved.id)
      )
      toast.success('Saved query deleted')
    } catch (error) {
      console.error('Failed to delete saved query', error)
      const message =
        error instanceof Error ? error.message : 'Could not delete query'
      toast.error(message)
    }
  }, [])

  const handleOpenSavedQuery = useCallback(
    async (saved: SavedQuery) => {
      try {
        // Ensure latest version before opening
        const latest = await fetchSavedQuery(saved.id)
        const resolved = latest ?? saved
        onOpenSavedQuery(resolved)
        setIsDropdownOpen(false)
      } catch (error) {
        console.error('Failed to load saved query before opening', error)
        toast.error('Unable to open saved query')
      }
    },
    [onOpenSavedQuery]
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasQueryToSave}
        onClick={openCreateDialog}
        className="hover:border-primary hover:text-primary"
      >
        <BookmarkPlus aria-hidden />
        <span className="hidden sm:inline-block">Save query</span>
      </Button>

      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <BookMarked aria-hidden />
            <span className="hidden sm:inline-block">Saved queries</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[340px]" align="end">
          <div className="flex items-center justify-between px-2 py-1.5">
            <DropdownMenuLabel className="p-0">
              Shared saved queries
            </DropdownMenuLabel>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => void refreshSavedQueries()}
              disabled={isLoadingList}
            >
              {isLoadingList ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span className="sr-only">Refresh saved queries</span>
            </Button>
          </div>
          <DropdownMenuSeparator />
          <ScrollArea className="max-h-80">
            <div className="space-y-1 px-1 pb-2">
              {isLoadingList ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : savedQueries.length === 0 ? (
                <div className="px-2 py-4 text-sm text-muted-foreground">
                  No saved queries yet.
                </div>
              ) : (
                savedQueries.map((saved) => (
                  <DropdownMenuItem
                    key={saved.id}
                    className="flex flex-col items-start gap-1 py-2"
                    onSelect={(event) => {
                      event.preventDefault()
                      void handleOpenSavedQuery(saved)
                    }}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {saved.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {saved.ownerUsername}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {saved.query}
                        </p>
                        <div className="text-[11px] text-muted-foreground">
                          Updated{' '}
                          {formatDistanceToNow(new Date(saved.updatedAt), {
                            addSuffix: true
                          })}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleOpenSavedQuery(saved)
                          }}
                        >
                          <ExternalLink className="size-4" />
                          <span className="sr-only">Open saved query</span>
                        </Button>
                        <CopyToClipboardButton
                          textToCopy={`${window.location.origin}/sparql?savedQueryId=${encodeURIComponent(
                            saved.id
                          )}`}
                          tooltipText="Copy link"
                          copiedTooltipText="Link copied"
                          successMessage="Saved query link copied"
                          errorMessage="Failed to copy link"
                          copyIcon={<LinkIcon />}
                        />
                        {saved.isOwner || isAdmin ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(event) => {
                                event.stopPropagation()
                                openEditDialog(saved)
                              }}
                            >
                              <Pencil className="size-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleDelete(saved)
                              }}
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </ScrollArea>
          {isAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  void router.push('/admin/saved-queries')
                }}
              >
                <Settings2 className="size-4" />
                Manage saved queries
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'edit' ? 'Edit saved query' : 'Save this query'}
            </DialogTitle>
            <DialogDescription>
              Saved queries are shared with everyone. Name it clearly so others
              know what it does.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="saved-query-name">
                Name
              </label>
              <Input
                id="saved-query-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Give this query a name"
              />
            </div>
            <div className="space-y-1 grid">
              <label className="text-sm font-medium" htmlFor="saved-query-body">
                Query
              </label>
              <Textarea
                id="saved-query-body"
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                className="min-h-[180px] font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleDialogSubmit()}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {dialogMode === 'edit' ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
