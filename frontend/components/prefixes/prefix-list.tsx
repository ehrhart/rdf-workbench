'use client'

import { CopyIcon, MoreHorizontalIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { CopyToClipboardButton } from '@/components/prefixes/copy-to-clipboard-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

interface PrefixListProps {
  prefixes: Record<string, string>
}

export function PrefixList({ prefixes }: PrefixListProps) {
  const [search, setSearch] = useState('')

  const entries = useMemo(
    () =>
      Object.entries(prefixes).sort(([a], [b]) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      ),
    [prefixes]
  )
  const filtered = entries.filter(
    ([prefix, uri]) =>
      prefix.toLowerCase().includes(search.toLowerCase()) ||
      uri.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prefixes</CardTitle>
        {entries.length > 0 && (
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search prefixes…"
            aria-label="Search prefixes"
            className="max-w-sm"
          />
        )}
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No namespaces have been added yet.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No namespaces match your search.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Prefix</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(([prefix, uri]) => (
                <TableRow key={prefix}>
                  <TableCell>
                    <div className="group font-mono font-semibold text-primary">
                      {prefix}:{' '}
                      <CopyToClipboardButton
                        textToCopy={`${prefix}:`}
                        tooltipText="Copy prefix"
                        successMessage="Prefix copied"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="group flex items-center gap-2">
                      <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm break-all">
                        {uri}
                      </code>
                      <CopyToClipboardButton
                        textToCopy={uri}
                        tooltipText="Copy URI"
                        successMessage="URI copied"
                        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
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
                            navigator.clipboard.writeText(
                              `PREFIX ${prefix}: <${uri}>`
                            )
                            toast.success('SPARQL declaration copied')
                          }}
                        >
                          <CopyIcon />
                          Copy SPARQL declaration
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
