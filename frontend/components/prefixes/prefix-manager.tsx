'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState
} from '@tanstack/react-table'
import {
  ArrowUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
import { CopyToClipboardButton } from '@/components/prefixes/copy-to-clipboard-button'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
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
  addPrefix,
  deletePrefix,
  getPrefixes,
  updatePrefix
} from '@/lib/prefix-actions'

interface PrefixManagerProps {
  initialPrefixes: Record<string, string>
  canManage?: boolean
  scopeLabel?: string
}

interface PrefixEntry {
  prefix: string
  namespace: string
}

type ConflictType = 'prefix' | 'namespace'

interface PrefixConflict {
  type: ConflictType
  existing: PrefixEntry
}

interface OverwriteDialogState {
  mode: 'create' | 'edit'
  newEntry: PrefixEntry
  conflicts: PrefixConflict[]
  originalPrefix?: string
}

const toEntry = (values: z.infer<typeof formSchema>): PrefixEntry => ({
  prefix: values.prefix.trim(),
  namespace: values.namespace.trim()
})

const findConflicts = (
  entry: PrefixEntry,
  prefixes: Record<string, string>,
  excludePrefix?: string
): PrefixConflict[] => {
  const conflicts: PrefixConflict[] = []
  const existingNamespace = prefixes[entry.prefix]

  if (typeof existingNamespace === 'string' && entry.prefix !== excludePrefix) {
    conflicts.push({
      type: 'prefix',
      existing: { prefix: entry.prefix, namespace: existingNamespace }
    })
  }

  for (const [prefix, namespace] of Object.entries(prefixes)) {
    if (
      namespace === entry.namespace &&
      prefix !== excludePrefix &&
      prefix !== entry.prefix
    ) {
      conflicts.push({
        type: 'namespace',
        existing: { prefix, namespace }
      })
    }
  }

  return conflicts
}

const formSchema = z.object({
  prefix: z.string().min(1, 'Prefix is required'),
  namespace: z.string().url('Namespace must be a valid URI')
})

export function PrefixManager({
  initialPrefixes,
  canManage = true,
  scopeLabel = 'Virtuoso'
}: PrefixManagerProps) {
  // Convert object to array for table
  const [prefixes, setPrefixes] =
    useState<Record<string, string>>(initialPrefixes)
  const prefixArray: PrefixEntry[] = useMemo(
    () =>
      Object.entries(prefixes)
        .map(([prefix, namespace]) => ({
          prefix,
          namespace
        }))
        .sort((a, b) => a.prefix.localeCompare(b.prefix)),
    [prefixes]
  )

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'prefix', desc: false }
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingPrefix, setEditingPrefix] = useState<PrefixEntry | null>(null)
  const [overwriteState, setOverwriteState] =
    useState<OverwriteDialogState | null>(null)
  const [isOverwriteSubmitting, setIsOverwriteSubmitting] = useState(false)

  const prefixConflict = overwriteState?.conflicts.find(
    (conflict) => conflict.type === 'prefix'
  )
  const namespaceConflicts =
    overwriteState?.conflicts.filter(
      (conflict) => conflict.type === 'namespace'
    ) ?? []
  const hasPrefixConflict = Boolean(prefixConflict)
  const hasNamespaceConflict = namespaceConflicts.length > 0
  const dialogTitle = !overwriteState
    ? 'Resolve Prefix Conflict'
    : hasPrefixConflict && hasNamespaceConflict
      ? 'Prefix and Namespace Already Exist'
      : hasPrefixConflict
        ? 'Prefix Already Exists'
        : 'Namespace Already Exists'
  const dialogDescription = !overwriteState
    ? ''
    : [
        hasPrefixConflict
          ? `The prefix "${overwriteState.newEntry.prefix}" already exists in ${scopeLabel}.`
          : null,
        hasNamespaceConflict
          ? (() => {
              const namespaceValue = namespaceConflicts[0].existing.namespace
              const conflictPrefixes = namespaceConflicts
                .map((conflict) => `"${conflict.existing.prefix}"`)
                .join(', ')
              const prefixLabel =
                namespaceConflicts.length === 1 ? 'prefix' : 'prefixes'
              return `The namespace URI "${namespaceValue}" is already associated with the ${prefixLabel} ${conflictPrefixes}.`
            })()
          : null,
        `Confirming will delete the existing ${
          overwriteState.conflicts.length > 1 ? 'pairs' : 'pair'
        } before saving the new values.`
      ]
        .filter(Boolean)
        .join(' ')
  const confirmLabel = hasPrefixConflict ? 'Overwrite' : 'Confirm changes'

  const reloadPrefixes = async () => {
    try {
      const latest = await getPrefixes()
      setPrefixes(latest)
    } catch (error) {
      console.error('Failed to refresh prefixes:', error)
      toast.error('Failed to refresh prefixes.')
    }
  }

  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text

    const regex = new RegExp(
      `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi'
    )
    const parts = text.split(regex)

    let keyCounter = 0
    return parts.map((part) =>
      regex.test(part) ? (
        <mark
          key={`highlight-${keyCounter++}`}
          className="bg-yellow-200 dark:bg-yellow-600 px-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prefix: '',
      namespace: ''
    }
  })
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = form

  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prefix: '',
      namespace: ''
    }
  })
  const {
    register: editRegister,
    handleSubmit: handleEditFormSubmit,
    formState: { errors: editErrors }
  } = editForm

  const isCreateSubmitting = form.formState.isSubmitting
  const isEditSubmitting = editForm.formState.isSubmitting

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const entry = toEntry(values)

    const conflicts = findConflicts(entry, prefixes)
    if (conflicts.length > 0) {
      setOverwriteState({
        mode: 'create',
        newEntry: entry,
        conflicts
      })
      return
    }

    try {
      const created = await addPrefix(entry.prefix, entry.namespace)
      setPrefixes((prev) => ({ ...prev, ...created }))
      await reloadPrefixes()
      form.reset()
      toast.success(`Prefix ${entry.prefix} has been added successfully.`)
    } catch (error) {
      console.error('Failed to add prefix:', error)
      toast.error('Failed to add prefix. It might already exist.')
    }
  }

  const handleOverwriteConfirm = async () => {
    if (!overwriteState) return

    const { conflicts, mode, newEntry, originalPrefix } = overwriteState
    const sourcePrefix =
      mode === 'edit' ? (originalPrefix ?? editingPrefix?.prefix ?? null) : null

    if (mode === 'edit' && !sourcePrefix) {
      toast.error('Unable to determine the prefix to update.')
      setOverwriteState(null)
      return
    }

    try {
      setIsOverwriteSubmitting(true)

      const prefixesToRemove = Array.from(
        new Set(conflicts.map((conflict) => conflict.existing.prefix))
      )

      await Promise.all(prefixesToRemove.map((prefix) => deletePrefix(prefix)))

      if (mode === 'edit' && sourcePrefix) {
        const updated = await updatePrefix(
          sourcePrefix,
          newEntry.prefix,
          newEntry.namespace
        )
        setPrefixes((prev) => {
          const next = { ...prev }
          prefixesToRemove.forEach((prefix) => {
            delete next[prefix]
          })
          if (sourcePrefix !== newEntry.prefix) {
            delete next[sourcePrefix]
          }
          const [resultPrefix, resultNamespace] = Object.entries(
            updated
          )[0] ?? [newEntry.prefix, newEntry.namespace]
          next[resultPrefix] = resultNamespace
          return next
        })
        await reloadPrefixes()
        setEditDialogOpen(false)
        setEditingPrefix(null)
        editForm.reset()
        toast.success(
          `Prefix ${newEntry.prefix} has been updated successfully.`
        )
      } else {
        const created = await addPrefix(newEntry.prefix, newEntry.namespace)
        setPrefixes((prev) => {
          const next = { ...prev }
          prefixesToRemove.forEach((prefix) => {
            delete next[prefix]
          })
          const [resultPrefix, resultNamespace] = Object.entries(
            created
          )[0] ?? [newEntry.prefix, newEntry.namespace]
          next[resultPrefix] = resultNamespace
          return next
        })
        await reloadPrefixes()
        form.reset()
        toast.success(`Prefix ${newEntry.prefix} has been added successfully.`)
      }
    } catch (error) {
      console.error('Failed to overwrite prefix:', error)
      toast.error('Failed to overwrite prefix.')
    } finally {
      setIsOverwriteSubmitting(false)
      setOverwriteState(null)
    }
  }

  const handleOverwriteCancel = () => {
    if (isOverwriteSubmitting) return
    setOverwriteState(null)
  }

  const onEditSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!editingPrefix) return

    const entry = toEntry(values)
    const previousEntry = editingPrefix
    const previousPrefix = editingPrefix.prefix

    if (
      entry.prefix === editingPrefix.prefix &&
      entry.namespace === editingPrefix.namespace
    ) {
      setEditDialogOpen(false)
      setEditingPrefix(null)
      editForm.reset()
      toast.info('No changes detected.')
      return
    }

    const conflicts = findConflicts(entry, prefixes, previousPrefix)
    if (conflicts.length > 0) {
      setOverwriteState({
        mode: 'edit',
        newEntry: entry,
        conflicts,
        originalPrefix: editingPrefix.prefix
      })
      return
    }

    setEditingPrefix(entry)

    try {
      const updated = await updatePrefix(
        editingPrefix.prefix,
        entry.prefix,
        entry.namespace
      )
      setPrefixes((prev) => {
        const next = { ...prev }
        if (previousPrefix !== entry.prefix) {
          delete next[previousPrefix]
        }
        const [resultPrefix, resultNamespace] = Object.entries(updated)[0] ?? [
          entry.prefix,
          entry.namespace
        ]
        next[resultPrefix] = resultNamespace
        return next
      })
      await reloadPrefixes()
      setEditDialogOpen(false)
      setEditingPrefix(null)
      editForm.reset()
      toast.success(`Prefix ${entry.prefix} has been updated successfully.`)
    } catch (error) {
      console.error('Failed to update prefix:', error)
      setEditingPrefix(previousEntry)
      toast.error('Failed to update prefix.')
    }
  }

  const handleEdit = (entry: PrefixEntry) => {
    setEditingPrefix(entry)
    editForm.reset({
      prefix: entry.prefix,
      namespace: entry.namespace
    })
    setEditDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(`Are you sure you want to delete the prefix: ${id}?`)) {
      return
    }

    try {
      await deletePrefix(id)
      setPrefixes((prev) => {
        const newPrefixes = { ...prev }
        delete newPrefixes[id]
        return newPrefixes
      })
      toast.success('The prefix has been deleted successfully.')
    } catch (error) {
      console.error('Failed to delete prefix:', error)
      toast.error('Failed to delete prefix.')
    }
  }

  const handleDeleteSelected = async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const selectedPrefixes = selectedRows.map((row) => row.original.prefix)

    if (selectedPrefixes.length === 0) return

    if (
      !confirm(
        `Are you sure you want to delete ${selectedPrefixes.length} selected prefixes?`
      )
    ) {
      return
    }

    try {
      for (const prefix of selectedPrefixes) {
        await deletePrefix(prefix)
      }

      setPrefixes((prev) => {
        const newPrefixes = { ...prev }
        selectedPrefixes.forEach((prefix) => {
          delete newPrefixes[prefix]
        })
        return newPrefixes
      })
      setRowSelection({})

      toast.success(
        `${selectedPrefixes.length} prefixes have been deleted successfully.`
      )
    } catch (error) {
      console.error('Failed to delete selected prefixes:', error)
      toast.error('Failed to delete one or more prefixes.')
    }
  }

  // Define columns for the table
  const columns: ColumnDef<PrefixEntry>[] = [
    ...(canManage
      ? [
          {
            id: 'select',
            header: ({ table }) => (
              <Checkbox
                checked={
                  table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && 'indeterminate')
                }
                onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(!!value)
                }
                aria-label="Select all"
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
              />
            ),
            enableSorting: false,
            enableHiding: false
          } satisfies ColumnDef<PrefixEntry>
        ]
      : []),
    {
      accessorKey: 'prefix',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Prefix
            <ArrowUpDownIcon className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const prefix = row.getValue('prefix') as string
        return (
          <div className="group font-mono font-semibold text-primary">
            {highlightText(prefix, globalFilter)}:{' '}
            <CopyToClipboardButton
              textToCopy={`${prefix}:`}
              tooltipText="Copy prefix"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        )
      }
    },
    {
      accessorKey: 'namespace',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Namespace URI
            <ArrowUpDownIcon className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const namespace = row.getValue('namespace') as string
        return (
          <div className="group flex items-center gap-2">
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
              {highlightText(namespace, globalFilter)}
            </code>
            <CopyToClipboardButton
              textToCopy={namespace}
              tooltipText="Copy namespace"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        )
      }
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const entry = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(`${entry.prefix}:`)
                  toast.success(`Copied prefix to clipboard`)
                }}
              >
                <CopyIcon />
                Copy Prefix
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(entry.namespace)
                  toast.success(`Copied namespace URI to clipboard`)
                }}
              >
                <CopyIcon />
                Copy Namespace
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(
                    `PREFIX ${entry.prefix}: <${entry.namespace}>`
                  )
                  toast.success(`Copied SPARQL declaration to clipboard`)
                }}
              >
                <CopyIcon />
                Copy SPARQL Declaration
              </DropdownMenuItem>
              {canManage && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleEdit(entry)}>
                    <PencilIcon />
                    Edit Prefix
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(entry.prefix)}
                    className="text-destructive focus:text-destructive"
                  >
                    <TrashIcon className="stroke-destructive" />
                    Delete Prefix
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]

  const table = useReactTable<PrefixEntry>({
    data: prefixArray,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const searchValue = filterValue.toLowerCase()
      const prefix = row.getValue('prefix') as string
      const namespace = row.getValue('namespace') as string

      return (
        prefix.toLowerCase().includes(searchValue) ||
        namespace.toLowerCase().includes(searchValue)
      )
    }
  })

  return (
    <div className="space-y-6 relative pb-24">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Prefix</CardTitle>
            <CardDescription>
              Add a new namespace prefix for use in SPARQL queries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field data-invalid={Boolean(errors.prefix)}>
                  <FieldLabel htmlFor="prefix">Prefix</FieldLabel>
                  <Input
                    id="prefix"
                    placeholder="rdf"
                    disabled={isCreateSubmitting}
                    {...register('prefix')}
                  />
                  <FieldError errors={[errors.prefix]} />
                </Field>
                <Field data-invalid={Boolean(errors.namespace)}>
                  <FieldLabel htmlFor="namespace">Namespace URI</FieldLabel>
                  <Input
                    id="namespace"
                    placeholder="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                    disabled={isCreateSubmitting}
                    {...register('namespace')}
                  />
                  <FieldError errors={[errors.namespace]} />
                </Field>
              </div>
              <Button type="submit" disabled={isCreateSubmitting}>
                {isCreateSubmitting ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <PlusIcon />
                )}
                Add Prefix
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{canManage ? 'Manage Prefixes' : 'Prefixes'}</CardTitle>
          <CardDescription>
            {canManage
              ? 'View, edit, and delete existing namespace prefixes'
              : 'View and copy namespace prefixes available to SPARQL queries'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Input
              placeholder="Filter prefixes..."
              value={table.getState().globalFilter ?? ''}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <p>No prefixes found</p>
                        {canManage && (
                          <p className="text-sm mt-1">
                            Add a prefix above to get started
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              {canManage
                ? `${table.getFilteredSelectedRowModel().rows.length} of ${table.getFilteredRowModel().rows.length} row(s) selected.`
                : `${table.getFilteredRowModel().rows.length} prefix(es).`}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeftIcon />
                Previous
              </Button>
              <div className="text-sm text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of{' '}
                {table.getPageCount()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floating Bulk Actions Bar */}
      {canManage && table.getFilteredSelectedRowModel().rows.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <Card className="shadow-2xl border border-primary/20 bg-background/95">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Selection Info */}
                <div className="flex items-center gap-3 pr-4 border-r">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Checkbox
                      checked={true}
                      className="h-5 w-5"
                      aria-label="Selected items indicator"
                      onClick={() => {
                        setRowSelection({})
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {table.getFilteredSelectedRowModel().rows.length}{' '}
                      {table.getFilteredSelectedRowModel().rows.length === 1
                        ? 'prefix'
                        : 'prefixes'}{' '}
                      selected
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ready for bulk actions
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => {
                      const selectedRows =
                        table.getFilteredSelectedRowModel().rows
                      const sparqlDeclarations = selectedRows
                        .map(
                          (row) =>
                            `PREFIX ${row.original.prefix}: <${row.original.namespace}>`
                        )
                        .join('\n')
                      navigator.clipboard.writeText(sparqlDeclarations)
                      toast.success(
                        `Copied ${selectedRows.length} SPARQL declarations to clipboard`
                      )
                    }}
                    className="gap-2"
                  >
                    <CopyIcon />
                    Copy SPARQL
                  </Button>

                  <Button
                    variant="destructive"
                    size="default"
                    onClick={handleDeleteSelected}
                    className="gap-2"
                  >
                    <TrashIcon />
                    Delete
                  </Button>

                  <div className="h-8 w-px bg-border mx-1" />

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRowSelection({})}
                    className="h-9 w-9"
                    title="Clear selection"
                  >
                    <XIcon />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Prefix</DialogTitle>
            <DialogDescription>
              Update the prefix name and/or namespace URI.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleEditFormSubmit(onEditSubmit)}
            className="space-y-4"
          >
            <Field data-invalid={Boolean(editErrors.prefix)}>
              <FieldLabel htmlFor="edit-prefix">Prefix</FieldLabel>
              <Input
                id="edit-prefix"
                disabled={isEditSubmitting || isOverwriteSubmitting}
                {...editRegister('prefix')}
              />
              <FieldError errors={[editErrors.prefix]} />
            </Field>
            <Field data-invalid={Boolean(editErrors.namespace)}>
              <FieldLabel htmlFor="edit-namespace">Namespace URI</FieldLabel>
              <Input
                id="edit-namespace"
                placeholder="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                disabled={isEditSubmitting || isOverwriteSubmitting}
                {...editRegister('namespace')}
              />
              <FieldError errors={[editErrors.namespace]} />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false)
                  setEditingPrefix(null)
                  editForm.reset()
                }}
                disabled={isEditSubmitting || isOverwriteSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isEditSubmitting || isOverwriteSubmitting}
              >
                {isEditSubmitting ? (
                  <Loader2Icon className="animate-spin" />
                ) : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Overwrite Confirmation Dialog */}
      <Dialog
        open={Boolean(overwriteState)}
        onOpenChange={(open) => {
          if (!open) {
            handleOverwriteCancel()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          {overwriteState && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Existing{' '}
                  {overwriteState.conflicts.length > 1 ? 'entries' : 'entry'}
                </p>
                <div className="mt-2 space-y-2">
                  {overwriteState.conflicts.map((conflict) => (
                    <div
                      key={`${conflict.type}-${conflict.existing.prefix}`}
                      className="space-y-1 rounded border border-border bg-muted/40 p-3"
                    >
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        {conflict.type === 'prefix'
                          ? 'Prefix conflict'
                          : 'Namespace conflict'}
                      </div>
                      <div className="font-mono text-sm">
                        Prefix: {conflict.existing.prefix}
                      </div>
                      <div className="font-mono text-sm">
                        Namespace: {conflict.existing.namespace}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  New entry
                </p>
                <div className="mt-2 space-y-1 rounded border border-border p-3">
                  <div className="font-mono text-sm">
                    Prefix: {overwriteState.newEntry.prefix}
                  </div>
                  <div className="font-mono text-sm">
                    Namespace: {overwriteState.newEntry.namespace}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleOverwriteCancel}
              disabled={isOverwriteSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleOverwriteConfirm}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={isOverwriteSubmitting}
            >
              {isOverwriteSubmitting ? (
                <Loader2Icon className="animate-spin" />
              ) : null}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
