'use client'

import { Network, Table } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ResourceAutocomplete } from './resource-autocomplete'

export function ResourceSearch({
  enableSuggestions = true
}: {
  enableSuggestions?: boolean
}) {
  const [searchType, setSearchType] = useState<'table' | 'visual'>('table')

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <ResourceAutocomplete
            searchType={searchType}
            enableSuggestions={enableSuggestions}
          />
        </div>

        <div className="flex">
          <Button
            variant={searchType === 'table' ? 'default' : 'outline'}
            className="rounded-r-none"
            onClick={() => setSearchType('table')}
          >
            <Table className="mr-2 h-4 w-4" />
            Table
          </Button>
          <Button
            variant={searchType === 'visual' ? 'default' : 'outline'}
            className="rounded-l-none"
            onClick={() => setSearchType('visual')}
          >
            <Network className="mr-2 h-4 w-4" />
            Visual
          </Button>
        </div>
      </div>
    </div>
  )
}
