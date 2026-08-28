'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  Field,
  FieldDescription,
  FieldError,
  FieldLabel
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { addFTRule, deleteFTRule } from '@/providers/virtuoso/fulltext'
import type { FTRule } from '@/types'
import { IndexStatusCard } from './index-status-card'

interface FullTextIndexManagerProps {
  initialRules: FTRule[]
}

const formSchema = z.object({
  graph: z.string().optional(),
  predicate: z.string().optional(),
  reason: z.string().min(1, 'Reason is required')
})

export function FullTextIndexManager({
  initialRules
}: FullTextIndexManagerProps) {
  const [rules, setRules] = useState<FTRule[]>(initialRules)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      graph: '',
      predicate: '',
      reason: ''
    }
  })

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = form

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true)
    try {
      const graph = values.graph?.trim() || null
      const predicate = values.predicate?.trim() || null

      const result = await addFTRule(graph, predicate, values.reason)

      if (result.added) {
        // Add the new rule to the local state
        setRules([
          ...rules,
          {
            ROFR_G: graph,
            ROFR_P: predicate,
            ROFR_REASON: values.reason
          }
        ])
        form.reset()
        toast.success('Full-text indexing rule added successfully.')
      } else {
        toast.info('This rule already exists.')
      }
    } catch (error) {
      console.error('Failed to add FT rule:', error)
      toast.error('Failed to add full-text indexing rule.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (rule: FTRule) => {
    try {
      const result = await deleteFTRule(
        rule.ROFR_G,
        rule.ROFR_P,
        rule.ROFR_REASON
      )

      if (result.deleted) {
        setRules((prev) =>
          prev.filter(
            (r) =>
              !(
                r.ROFR_G === rule.ROFR_G &&
                r.ROFR_P === rule.ROFR_P &&
                r.ROFR_REASON === rule.ROFR_REASON
              )
          )
        )
        toast.success('Full-text indexing rule deleted successfully.')
      } else {
        toast.error('Rule not found.')
      }
    } catch (error) {
      console.error('Failed to delete FT rule:', error)
      toast.error('Failed to delete full-text indexing rule.')
    }
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>About Full-Text Indexing</AlertTitle>
        <AlertDescription>
          <div>
            Full-text indexing enables fast text search on RDF object values
            using{' '}
            <code className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-xs">
              bif:contains
            </code>{' '}
            in SPARQL queries. Configure which triples to index by specifying
            graph and predicate combinations. Leave fields empty to use
            wildcards (all graphs or all predicates).
          </div>
        </AlertDescription>
      </Alert>

      <IndexStatusCard />

      <Card>
        <CardHeader>
          <CardTitle>Add New Indexing Rule</CardTitle>
          <CardDescription>
            Configure which RDF triples should be indexed for full-text search.
            Empty fields will match all graphs or all predicates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field data-invalid={Boolean(errors.graph)}>
                <FieldLabel htmlFor="graph">Graph IRI</FieldLabel>
                <Input
                  id="graph"
                  placeholder="Leave empty for all graphs"
                  {...register('graph')}
                />
                <FieldDescription>
                  Optional: specific graph to index
                </FieldDescription>
                <FieldError errors={[errors.graph]} />
              </Field>
              <Field data-invalid={Boolean(errors.predicate)}>
                <FieldLabel htmlFor="predicate">Predicate IRI</FieldLabel>
                <Input
                  id="predicate"
                  placeholder="Leave empty for all predicates"
                  {...register('predicate')}
                />
                <FieldDescription>
                  Optional: specific predicate to index
                </FieldDescription>
                <FieldError errors={[errors.predicate]} />
              </Field>
              <Field data-invalid={Boolean(errors.reason)}>
                <FieldLabel htmlFor="reason">Reason</FieldLabel>
                <Input
                  id="reason"
                  placeholder="e.g., MyApp"
                  {...register('reason')}
                />
                <FieldDescription>
                  Application or purpose identifier
                </FieldDescription>
                <FieldError errors={[errors.reason]} />
              </Field>
            </div>
            <Button type="submit" disabled={isSubmitting}>
              <Plus className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Adding...' : 'Add Rule'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Indexing Rules</CardTitle>
          <CardDescription>
            {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Graph</TableHead>
                  <TableHead>Predicate</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      No full-text indexing rules configured
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow
                      key={`${rule.ROFR_G ?? 'ALL'}|${rule.ROFR_P ?? 'ALL'}|${rule.ROFR_REASON}`}
                    >
                      <TableCell className="font-mono text-xs">
                        {rule.ROFR_G ? (
                          rule.ROFR_G
                        ) : (
                          <Badge variant="secondary">All Graphs</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {rule.ROFR_P ? (
                          rule.ROFR_P
                        ) : (
                          <Badge variant="secondary">All Predicates</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge>{rule.ROFR_REASON}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rule)}
                        >
                          <Trash className="stroke-destructive" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
