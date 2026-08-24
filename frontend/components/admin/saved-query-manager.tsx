'use client'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDistanceToNow } from 'date-fns'
import { GripVertical, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  createSavedQueryClient,
  deleteSavedQueryClient,
  fetchSavedQueries,
  reorderSavedQueriesClient,
  updateSavedQueryClient
} from '@/lib/client/saved-queries'
import type { SavedQuery } from '@/types'

interface SavedQueryItem {
  id: string
  name: string
  query: string
  ownerUsername: string
  updatedAt: string
}

interface Draft {
  id: string
  name: string
  query: string
  isNew: boolean
}

const toItem = (saved: SavedQuery): SavedQueryItem => ({
  id: saved.id,
  name: saved.name,
  query: saved.query,
  ownerUsername: saved.ownerUsername,
  updatedAt: saved.updatedAt
})

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'relative z-10 opacity-60' : undefined}
    >
      <TableCell className="w-9 align-middle">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      {children}
    </TableRow>
  )
}

export function SavedQueryManager() {
  const [items, setItems] = useState<SavedQueryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [draft, setDraft] = useState<Draft>({
    id: '',
    name: '',
    query: '',
    isNew: true
  })
  const [isSaving, setIsSaving] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      const list = await fetchSavedQueries()
      setItems(list.map(toItem))
    } catch (error) {
      console.error('Failed to load saved queries', error)
      toast.error('Unable to load saved queries right now')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setDialogMode('create')
    setDraft({ id: '', name: '', query: '', isNew: true })
    setIsDialogOpen(true)
  }

  const openEdit = (item: SavedQueryItem) => {
    setDialogMode('edit')
    setDraft({
      id: item.id,
      name: item.name,
      query: item.query,
      isNew: false
    })
    setIsDialogOpen(true)
  }

  const saveDraft = async () => {
    const name = draft.name.trim()
    const query = draft.query.trim()
    if (!name) {
      toast.error('Give the saved query a name')
      return
    }
    if (!query) {
      toast.error('Query cannot be empty')
      return
    }

    setIsSaving(true)
    try {
      if (draft.isNew) {
        const created = await createSavedQueryClient({ name, query })
        setItems((current) => [...current, toItem(created)])
        toast.success('Saved query created')
      } else {
        const updated = await updateSavedQueryClient(draft.id, { name, query })
        setItems((current) =>
          current.map((item) =>
            item.id === updated.id ? toItem(updated) : item
          )
        )
        toast.success('Saved query updated')
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
  }

  const deleteItem = async (item: SavedQueryItem) => {
    const confirmed = window.confirm(
      `Delete "${item.name}" for everyone? This cannot be undone.`
    )
    if (!confirmed) return

    setPending(item.id)
    try {
      await deleteSavedQueryClient(item.id)
      setItems((current) =>
        current.filter((candidate) => candidate.id !== item.id)
      )
      toast.success('Saved query deleted')
    } catch (error) {
      console.error('Failed to delete saved query', error)
      const message =
        error instanceof Error ? error.message : 'Could not delete query'
      toast.error(message)
    } finally {
      setPending(null)
    }
  }

  const persistOrder = async (ordered: SavedQueryItem[]) => {
    const order = ordered.map((item, position) => ({
      id: item.id,
      position
    }))
    try {
      await reorderSavedQueriesClient(order)
      toast.success('Saved query order updated')
    } catch (error) {
      console.error('Failed to reorder saved queries', error)
      const message =
        error instanceof Error ? error.message : 'Could not reorder queries'
      toast.error(message)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id)
      const newIndex = current.findIndex((item) => item.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return current
      const reordered = arrayMove(current, oldIndex, newIndex)
      void persistOrder(reordered)
      return reordered
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={openCreate}>
          <Plus aria-hidden />
          New query
        </Button>
      </div>

      <div className="rounded-md border">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-9" />
                <TableHead>Name</TableHead>
                <TableHead>Query</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <SortableContext
              items={items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-muted-foreground"
                    >
                      <Loader2 className="mx-auto size-5 animate-spin" />
                      Loading saved queries…
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center">
                      <div className="mx-auto flex max-w-xs flex-col items-center gap-2 text-muted-foreground">
                        <span className="text-sm font-medium text-foreground">
                          No saved queries yet
                        </span>
                        <span className="text-sm">
                          Create the first shared query to get started.
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={openCreate}
                        >
                          <Plus aria-hidden />
                          New query
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <SortableRow key={item.id} id={item.id}>
                      <TableCell className="max-w-[14rem] align-middle font-medium">
                        <span className="block truncate">{item.name}</span>
                      </TableCell>
                      <TableCell className="max-w-[28rem] align-middle">
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {item.query}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle">
                        {item.ownerUsername}
                      </TableCell>
                      <TableCell className="align-middle text-muted-foreground">
                        {formatDistanceToNow(new Date(item.updatedAt), {
                          addSuffix: true
                        })}
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(item)}
                              >
                                <Pencil className="size-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={pending !== null}
                                onClick={() => deleteItem(item)}
                              >
                                {pending === item.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                                <span className="sr-only">Delete</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </SortableRow>
                  ))
                )}
              </TableBody>
            </SortableContext>
          </Table>
        </DndContext>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'edit' ? 'Edit saved query' : 'New saved query'}
            </DialogTitle>
            <DialogDescription>
              Saved queries are shared with everyone. Name it clearly so others
              know what it does.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="sq-name">
                Name
              </label>
              <Input
                id="sq-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
                placeholder="Give this query a name"
              />
            </div>
            <div className="grid space-y-1">
              <label className="text-sm font-medium" htmlFor="sq-body">
                Query
              </label>
              <Textarea
                id="sq-body"
                value={draft.query}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    query: event.target.value
                  }))
                }
                className="min-h-[180px] font-mono text-sm"
                placeholder="SELECT * WHERE { ?s ?p ?o }"
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
              onClick={() => void saveDraft()}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {dialogMode === 'edit' ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
