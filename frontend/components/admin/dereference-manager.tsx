'use client'

import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import {
  createDereferencePathAction,
  removeDereferencePathAction,
  renameDereferencePathAction
} from '@/app/(dashboard)/admin/dereference/actions'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import type { DereferencePath } from '@/lib/runtime/contracts'

interface DereferenceManagerProps {
  paths: DereferencePath[]
  reservedPaths: string[]
}

export function DereferenceManager({
  paths: initialPaths,
  reservedPaths
}: DereferenceManagerProps) {
  const [paths, setPaths] = useState<DereferencePath[]>(initialPaths)
  const [newPath, setNewPath] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<DereferencePath | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    const path = newPath.trim()
    if (!path) return

    setIsCreating(true)
    const result = await createDereferencePathAction(path)
    setIsCreating(false)

    if (result.ok) {
      setPaths((current) =>
        [...current, { path }].sort((a, b) => a.path.localeCompare(b.path))
      )
      setNewPath('')
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
  }

  const openRename = (entry: DereferencePath) => {
    setRenameTarget(entry)
    setRenameValue(entry.path)
  }

  const saveRename = async () => {
    if (!renameTarget) return
    const nextPath = renameValue.trim()
    if (!nextPath || nextPath === renameTarget.path) {
      setRenameTarget(null)
      return
    }

    setIsRenaming(true)
    const result = await renameDereferencePathAction(
      renameTarget.path,
      nextPath
    )
    setIsRenaming(false)

    if (result.ok) {
      setPaths((current) =>
        current
          .map((entry) =>
            entry.path === renameTarget.path ? { path: nextPath } : entry
          )
          .sort((a, b) => a.path.localeCompare(b.path))
      )
      toast.success(result.message)
      setRenameTarget(null)
    } else {
      toast.error(result.message)
    }
  }

  const handleRemove = async (entry: DereferencePath) => {
    const confirmed = window.confirm(
      `Remove "/${entry.path}"? Dereferenceable URLs under this path will stop working.`
    )
    if (!confirmed) return

    setPending(entry.path)
    const result = await removeDereferencePathAction(entry.path)
    setPending(null)

    if (result.ok) {
      setPaths((current) =>
        current.filter((candidate) => candidate.path !== entry.path)
      )
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a path</CardTitle>
          <CardDescription>
            A path is a lowercase slug.{' '}
            <span className="font-mono">/person/&lt;id&gt;</span> resolves to
            the resource{' '}
            <span className="font-mono">
              &lt;resource-base&gt;/person/&lt;id&gt;
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => void handleCreate(event)}
            className="flex items-center gap-2"
          >
            <Input
              value={newPath}
              onChange={(event) => setNewPath(event.target.value)}
              placeholder="e.g. person"
              className="max-w-xs font-mono"
              aria-label="New dereference path"
            />
            <Button type="submit" disabled={isCreating || !newPath.trim()}>
              {isCreating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus />
              )}
              Add path
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured paths</CardTitle>
          <CardDescription>
            These paths are dereferenceable. Add a resource such as{' '}
            <span className="font-mono">
              /{'<path>'}/{'<id>'}
            </span>{' '}
            to view it in the workbench.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Path</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paths.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No dereference paths configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                paths.map((entry) => (
                  <TableRow key={entry.path}>
                    <TableCell className="align-middle font-mono">
                      /{entry.path}
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
                              onClick={() => openRename(entry)}
                            >
                              <Pencil className="size-4" />
                              <span className="sr-only">Rename</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Rename</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={pending !== null}
                              onClick={() => void handleRemove(entry)}
                            >
                              {pending === entry.path ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                              <span className="sr-only">Remove</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reserved paths</CardTitle>
          <CardDescription>
            These paths are used by the workbench or the triplestore and cannot
            be added.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {reservedPaths.map((path) => (
            <Badge key={path} variant="outline" className="font-mono">
              /{path}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename path</DialogTitle>
            <DialogDescription>
              Existing dereferenceable URLs under this path will stop working.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="deref-path">
              New path
            </label>
            <Input
              id="deref-path"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              className="font-mono"
              placeholder="person"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameTarget(null)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveRename()}
              disabled={isRenaming || !renameValue.trim()}
            >
              {isRenaming ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
