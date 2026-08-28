'use client'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CopyToClipboardButton } from '@/components/prefixes/copy-to-clipboard-button'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupIcon,
  InputGroupInput
} from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ResultsRawProps {
  results: unknown
}

export default memo(function ResultsRaw({ results }: ResultsRawProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [matches, setMatches] = useState<
    Array<{ lineIndex: number; start: number; end: number }>
  >([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const parentRef = useRef<HTMLDivElement>(null)

  const getScrollElement = () => {
    if (!parentRef.current) return null
    return parentRef.current.querySelector('[data-radix-scroll-area-viewport]')
  }

  const jsonLines = useMemo(() => {
    if (!results) return []
    try {
      return JSON.stringify(results, null, 2).split('\n')
    } catch (error) {
      console.error('Error stringifying results:', error)
      return ['Error: Unable to stringify results']
    }
  }, [results])

  useEffect(() => {
    if (searchTerm) {
      const foundMatches: Array<{
        lineIndex: number
        start: number
        end: number
      }> = []
      const regex = new RegExp(
        searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'gi'
      )
      jsonLines.forEach((line, lineIndex) => {
        regex.lastIndex = 0
        let match: RegExpExecArray | null = regex.exec(line)
        while (match !== null) {
          foundMatches.push({
            lineIndex,
            start: match.index,
            end: match.index + match[0].length
          })
          match = regex.exec(line)
        }
      })
      setMatches(foundMatches)
      setCurrentMatchIndex(foundMatches.length > 0 ? 0 : -1)
    } else {
      setMatches([])
      setCurrentMatchIndex(-1)
    }
  }, [searchTerm, jsonLines])

  const virtualizer = useVirtualizer({
    count: jsonLines.length,
    getScrollElement,
    estimateSize: () => 20,
    overscan: 5
  })

  useEffect(() => {
    if (currentMatchIndex >= 0 && matches[currentMatchIndex] !== undefined) {
      virtualizer.scrollToIndex(matches[currentMatchIndex].lineIndex, {
        align: 'center'
      })
    }
  }, [currentMatchIndex, matches, virtualizer])

  const goToNextMatch = useCallback(() => {
    if (matches.length > 0) {
      const nextIndex = (currentMatchIndex + 1) % matches.length
      setCurrentMatchIndex(nextIndex)
    }
  }, [matches.length, currentMatchIndex])

  const goToPreviousMatch = useCallback(() => {
    if (matches.length > 0) {
      const prevIndex =
        (currentMatchIndex - 1 + matches.length) % matches.length
      setCurrentMatchIndex(prevIndex)
    }
  }, [matches.length, currentMatchIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (document.activeElement !== searchInputRef.current) {
          e.preventDefault()
          searchInputRef.current?.focus()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault()
        if (e.shiftKey) {
          goToPreviousMatch()
        } else {
          goToNextMatch()
        }
      } else if (
        e.key === 'Enter' &&
        document.activeElement === searchInputRef.current
      ) {
        e.preventDefault()
        if (e.shiftKey) {
          goToPreviousMatch()
        } else {
          goToNextMatch()
        }
      } else if (
        e.key === 'Escape' &&
        document.activeElement === searchInputRef.current
      ) {
        e.preventDefault()
        setSearchTerm('')
        searchInputRef.current?.blur()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [goToNextMatch, goToPreviousMatch])

  const highlightText = (
    text: string,
    searchTerm: string,
    lineIndex: number,
    lineMatches: Array<{ start: number; end: number }>,
    currentMatch: { lineIndex: number; start: number; end: number } | null
  ) => {
    if (!searchTerm) return text

    const elements: React.ReactElement[] = []
    let lastIndex = 0
    lineMatches.forEach((match) => {
      // Add text before match
      if (match.start > lastIndex) {
        elements.push(
          <span key={`${lineIndex}-text-${lastIndex}`}>
            {text.slice(lastIndex, match.start)}
          </span>
        )
      }
      // Add the match
      const isCurrent =
        currentMatch &&
        currentMatch.start === match.start &&
        currentMatch.end === match.end
      elements.push(
        <span
          key={`${lineIndex}-match-${match.start}`}
          style={{
            backgroundColor: isCurrent ? 'orange' : 'yellow',
            color: 'black'
          }}
        >
          {text.slice(match.start, match.end)}
        </span>
      )
      lastIndex = match.end
    })
    // Add remaining text
    if (lastIndex < text.length) {
      elements.push(
        <span key={`${lineIndex}-text-end`}>{text.slice(lastIndex)}</span>
      )
    }
    return <>{elements}</>
  }

  if (!results) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-muted-foreground">
        No results to display
      </div>
    )
  }

  if (jsonLines.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-muted-foreground">
        Empty results
      </div>
    )
  }

  return (
    <div className="h-[80vh] flex flex-col border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b bg-background">
        <InputGroup className="flex-1">
          <InputGroupIcon position="left">
            <SearchIcon className="size-4" />
          </InputGroupIcon>
          <InputGroupInput
            ref={searchInputRef}
            placeholder="Search in results..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 h-8"
          />
          {searchTerm && (
            <InputGroupIcon position="right">
              <XIcon
                className="size-4 cursor-pointer"
                onClick={() => setSearchTerm('')}
              />
            </InputGroupIcon>
          )}
        </InputGroup>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={goToPreviousMatch}
          disabled={matches.length === 0}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={goToNextMatch}
          disabled={matches.length === 0}
        >
          <ChevronRightIcon />
        </Button>
      </div>
      {searchTerm && (
        <div className="px-2 py-1 text-sm text-muted-foreground bg-muted">
          {matches.length > 0
            ? `${currentMatchIndex + 1} of ${matches.length} matches`
            : 'No matches found'}
        </div>
      )}

      <ScrollArea
        ref={parentRef}
        type="always"
        className="flex-1 overflow-auto group"
      >
        <CopyToClipboardButton
          textToCopy={JSON.stringify(results, null, 2)}
          tooltipText="Copy to clipboard"
          className="absolute top-2 right-2 z-10 group-hover:visible invisible group-hover:opacity-100 opacity-0 transition-opacity"
          variant="ghost"
          size="icon-sm"
        />
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const lineMatches = matches
              .filter((m) => m.lineIndex === virtualRow.index)
              .map((m) => ({ start: m.start, end: m.end }))
            const currentMatchInLine =
              matches[currentMatchIndex]?.lineIndex === virtualRow.index
                ? matches[currentMatchIndex]
                : null
            return (
              <div
                key={virtualRow.index}
                className="px-4 py-1 font-mono text-sm whitespace-pre"
                style={{
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                {highlightText(
                  jsonLines[virtualRow.index],
                  searchTerm,
                  virtualRow.index,
                  lineMatches,
                  currentMatchInLine
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
})
