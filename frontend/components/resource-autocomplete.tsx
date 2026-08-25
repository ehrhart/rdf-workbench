'use client'

import { Table } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { getResourceSuggestions } from '@/lib/triplestore'
import type { ResourceSuggestion } from '@/types'
import { AutoComplete } from './autocomplete'
import { Button } from './ui/button'

interface ResourceAutocompleteProps {
  searchType: 'table' | 'visual'
  showButton?: boolean
  defaultValue?: string
  enableSuggestions?: boolean
}

export function ResourceAutocomplete({
  searchType,
  showButton = false,
  defaultValue = '',
  enableSuggestions = true
}: ResourceAutocompleteProps) {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState<string>(defaultValue)
  const [suggestions, setSuggestions] = useState<
    { id: string; value: string; label: string; excerpt?: string }[]
  >([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

  const navigateToResource = (value: string) => {
    if (!value) return
    router.push(`/resource?uri=${encodeURIComponent(value)}`)
  }

  const navigateToVisualization = (value: string) => {
    if (!value) return
    router.push(`/graphs-visualizations?uri=${encodeURIComponent(value)}`)
  }

  const navigate = (value: string) => {
    if (searchType === 'table') {
      navigateToResource(value)
    } else {
      navigateToVisualization(value)
    }
  }

  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current)
    }

    if (enableSuggestions && searchInput.length >= 2) {
      setIsLoading(true)
      searchTimeout.current = setTimeout(async () => {
        try {
          const results = await getResourceSuggestions(searchInput)
          setSuggestions(
            results.map((item: ResourceSuggestion) => ({
              id: item.id,
              value: item.resource,
              label: item.resource,
              excerpt: item.excerpt
            }))
          )
        } catch (error) {
          console.error('Error fetching suggestions:', error)
        } finally {
          setIsLoading(false)
        }
      }, 300)
    } else {
      setSuggestions([])
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current)
      }
    }
  }, [searchInput, enableSuggestions])

  return (
    <div className="flex space-x-2 items-center">
      <AutoComplete
        selectedValue={searchInput}
        onSelectedValueChange={(value) => {
          navigate(value)
        }}
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        items={suggestions}
        isLoading={isLoading}
        emptyMessage={
          enableSuggestions
            ? 'Start typing to see suggestions...'
            : 'Enter a complete resource IRI and press Enter.'
        }
        placeholder={
          enableSuggestions ? 'Search resources...' : 'Enter a resource IRI...'
        }
        resetOnBlur={false}
      />
      {showButton && (
        <>
          <Button type="button" onClick={() => navigate(searchInput)}>
            Show
          </Button>
          {searchType === 'visual' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => navigateToResource(searchInput)}
            >
              <Table /> Resource
            </Button>
          )}
        </>
      )}
    </div>
  )
}
