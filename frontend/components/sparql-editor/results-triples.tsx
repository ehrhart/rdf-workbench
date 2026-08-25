'use client'

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon
} from 'lucide-react'
import { Parser, type Term } from 'n3'
import { memo, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { SparqlBindingValue, SparqlQueryResult } from '@/types'
import { renderBindingValue } from './results-table/table-columns'

const PAGE_SIZES = [50, 100, 250, 500]
const DEFAULT_PAGE_SIZE = 100

const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string'

interface TripleRow {
  subject: SparqlBindingValue
  predicate: SparqlBindingValue
  object: SparqlBindingValue
}

function termToBinding(term: Term): SparqlBindingValue | null {
  switch (term.termType) {
    case 'NamedNode':
      return { type: 'uri', value: term.value }
    case 'BlankNode':
      return { type: 'bnode', value: term.value }
    case 'Literal': {
      if (term.language) {
        return { type: 'literal', value: term.value, 'xml:lang': term.language }
      }
      const datatype = term.datatype?.value
      if (datatype && datatype !== XSD_STRING) {
        return { type: 'literal', value: term.value, datatype }
      }
      return { type: 'literal', value: term.value }
    }
    default:
      return null
  }
}

function ResultsTriples({ results }: { results: SparqlQueryResult }) {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const { rows, error } = useMemo(() => {
    if (results.kind !== 'graph') {
      return { rows: [] as TripleRow[], error: null }
    }
    try {
      const quads = new Parser().parse(results.value)
      const parsedRows = quads
        .map((quad) => ({
          subject: termToBinding(quad.subject),
          predicate: termToBinding(quad.predicate),
          object: termToBinding(quad.object)
        }))
        .filter(
          (row): row is TripleRow =>
            row.subject !== null &&
            row.predicate !== null &&
            row.object !== null
        )
      return { rows: parsedRows, error: null }
    } catch (err) {
      return {
        rows: [] as TripleRow[],
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }, [results])

  if (results.kind !== 'graph') {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border text-sm text-muted-foreground">
        No triples to display for this result
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border text-sm text-destructive">
        Failed to parse RDF graph: {error}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border text-sm text-muted-foreground">
        The query returned an empty graph
      </div>
    )
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePageIndex = Math.min(pageIndex, pageCount - 1)
  const start = safePageIndex * pageSize
  const end = Math.min(start + pageSize, rows.length)
  const keyedPageRows = rows
    .slice(start, end)
    .map((row, index) => ({ row, key: start + index }))

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-background px-3 py-2 text-sm text-muted-foreground">
        <span>
          Showing {start + 1}–{end} of {rows.length.toLocaleString()} triples
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm">Rows per page:</span>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              setPageSize(Number(value))
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm">
            Page {safePageIndex + 1} of {pageCount.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex(0)}
              disabled={safePageIndex === 0}
            >
              <ChevronsLeftIcon />
              <span className="sr-only">First page</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex(safePageIndex - 1)}
              disabled={safePageIndex === 0}
            >
              <ChevronLeftIcon />
              <span className="sr-only">Previous page</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex(safePageIndex + 1)}
              disabled={safePageIndex >= pageCount - 1}
            >
              <ChevronRightIcon />
              <span className="sr-only">Next page</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex(pageCount - 1)}
              disabled={safePageIndex >= pageCount - 1}
            >
              <ChevronsRightIcon />
              <span className="sr-only">Last page</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Predicate</TableHead>
              <TableHead>Object</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keyedPageRows.map(({ row, key }) => (
              <TableRow key={key}>
                <TableCell className="min-w-0 align-top">
                  <div className="whitespace-normal wrap-break-word">
                    {renderBindingValue(row.subject)}
                  </div>
                </TableCell>
                <TableCell className="min-w-0 align-top">
                  <div className="whitespace-normal wrap-break-word">
                    {renderBindingValue(row.predicate)}
                  </div>
                </TableCell>
                <TableCell className="min-w-0 align-top">
                  <div className="whitespace-normal wrap-break-word">
                    {renderBindingValue(row.object)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default memo(ResultsTriples)
