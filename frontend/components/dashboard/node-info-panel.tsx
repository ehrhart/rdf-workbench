'use client'

import { LinkIcon, MaximizeIcon, TrashIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { executeQuery } from '@/lib/triplestore'
import type { SparqlBindingValue } from '@/types'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '../ui/accordion'
import type { Node } from './graph-visualization'

interface Property {
  key: string
  value: string
}

interface NodeInfoPanelProps {
  node: Node
  onClose: () => void
  onExpand: () => void
  onRemove: () => void
}

export default function NodeInfoPanel({
  node,
  onClose,
  onExpand,
  onRemove
}: NodeInfoPanelProps) {
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const fetchNodeProperties = async (): Promise<void> => {
      setIsLoading(true)
      try {
        const query = `
          SELECT ?predicate ?object
          WHERE {
            <${node.id}> ?predicate ?object .
          }
        `

        const result = await executeQuery(query)

        if (result.kind === 'bindings') {
          const fetchedProperties = result.bindings.map(
            (binding: Record<string, SparqlBindingValue>) => ({
              key: binding.predicate?.value ?? '',
              value: binding.object?.value ?? ''
            })
          )
          setProperties(fetchedProperties)
        }
      } catch (error) {
        console.error('Error fetching node properties:', error)
        // Set basic properties even if the fetch fails
        setProperties([
          { key: 'rdfs:label', value: node.label },
          { key: 'rdf:type', value: node.type },
          { key: 'dc:identifier', value: node.id }
        ])
      } finally {
        setIsLoading(false)
      }
    }

    fetchNodeProperties()
  }, [node.id, node.label, node.type])

  // Filter properties based on search query
  const filteredProperties = properties.filter(
    (prop) =>
      prop.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prop.value.toString().toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Card className="absolute top-0 right-0 bottom-4 z-10 flex w-80 flex-col p-4 gap-2">
      <CardHeader className="flex flex-col justify-between gap-2 p-0">
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onExpand}>
                <MaximizeIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Expand node</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onRemove}>
                <TrashIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove node</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(node.id)
                  toast.success(`Copied node URI to clipboard`)
                }}
              >
                <LinkIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy URI</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <XIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </div>
        <CardTitle className="truncate text-lg font-semibold">
          {node.label}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-2 p-0 overflow-auto">
        {node.type && (
          <div className="text-muted-foreground text-sm">
            <span className="font-medium">Type:</span> {node.type}
          </div>
        )}
        <div className="text-muted-foreground text-sm">
          <span className="font-medium">URI:</span>{' '}
          <Link
            href={`/resource?uri=${node.id}`}
            target="_blank"
            rel="noopener"
            className="wrap-break-word text-blue-600 hover:underline"
          >
            {node.id}
          </Link>
        </div>

        <Input
          type="text"
          placeholder="Search properties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-auto"
        />

        <div className="flex w-full overflow-hidden">
          <ScrollArea className="flex flex-1">
            <Accordion type="single" collapsible defaultValue="properties">
              <AccordionItem value="properties">
                <AccordionTrigger className="py-2">Properties</AccordionTrigger>
                <AccordionContent className="">
                  <div className="space-y-2 pr-2">
                    {isLoading ? (
                      <div className="text-muted-foreground py-4 text-center text-sm">
                        Loading properties...
                      </div>
                    ) : filteredProperties.length > 0 ? (
                      filteredProperties.map((prop) => (
                        <div
                          key={prop.key + prop.value}
                          className="border-b pb-2 last:border-b-0"
                        >
                          <div className="text-sm font-medium">{prop.key}</div>
                          <div className="text-muted-foreground wrap-break-word text-sm">
                            {prop.value}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground py-4 text-center text-sm">
                        No properties found
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}
