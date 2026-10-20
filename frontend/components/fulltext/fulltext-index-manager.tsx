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
  reason: z.string().min(1, 'Reason is required.')
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
        toast.success('Rule added')
      } else {
        toast.info('Rule already exists')
      }
    } catch (error) {
      console.error('Failed to add FT rule:', error)
      toast.error("Couldn't add the rule.")
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
        toast.success('Rule deleted')
      } else {
        toast.error("Couldn't find that rule — it may already be gone.")
      }
    } catch (error) {
      console.error('Failed to delete FT rule:', error)
      toast.error("Couldn't delete the rule.")
    }
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>About full-text indexing</AlertTitle>
        <AlertDescription>
          <div>
            Indexes RDF object values for{' '}
            <code className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-xs">
              bif:contains
            </code>{' '}
            text search. Rules pick which graph and predicate pairs to index;
            leave a field empty to match all graphs or predicates.
          </div>
        </AlertDescription>
      </Alert>

      <IndexStatusCard />

      <Card>
        <CardHeader>
          <CardTitle>Add a rule</CardTitle>
          <CardDescription>
            One rule per graph and predicate pair. Leave a field empty to match
            all graphs or all predicates.
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
                  Limit the rule to one graph.
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
                  Limit the rule to one predicate.
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
                  A note on why the rule exists, shown in the list.
                </FieldDescription>
                <FieldError errors={[errors.reason]} />
              </Field>
            </div>
            <Button type="submit" disabled={isSubmitting}>
              <Plus className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Adding…' : 'Add rule'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indexing rules</CardTitle>
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
                      No rules yet. Index the values of rdfs:label by adding a
                      rule.
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
                          <Badge variant="secondary">All graphs</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {rule.ROFR_P ? (
                          rule.ROFR_P
                        ) : (
                          <Badge variant="secondary">All predicates</Badge>
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
