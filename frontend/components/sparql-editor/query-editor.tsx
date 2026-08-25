'use client'

import '@zazuko/yasgui/build/yasgui.min.css'
import Yasqe from '@zazuko/yasqe'
import type {
  AutocompletionToken,
  CompleterConfig
} from '@zazuko/yasqe/build/ts/src/autocompleters'
import { Braces, RefreshCw, ScanSearch, TriangleAlert } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ResizableBox, type ResizeCallbackData } from 'react-resizable'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface QueryEditorProps {
  prefixes?: Record<string, string>
  value: string
  onChange?: (yasqe: Yasqe) => void
  activeTabId?: string
}

const MAX_SUGGESTIONS = 100

const getTokenSearchText = (token?: AutocompletionToken): string => {
  if (!token) return ''
  if (typeof token.autocompletionString === 'string') {
    return token.autocompletionString
  }
  const candidate = token as unknown as { string?: string }
  if (typeof candidate?.string === 'string') {
    return candidate.string
  }
  return ''
}

const buildPrefixSuggestions = (prefixMap: Record<string, string>): string[] =>
  Object.entries(prefixMap)
    .filter(([prefix, iri]) => Boolean(prefix && iri))
    .map(([prefix, iri]) => `${prefix}: <${iri}>`)
    .sort((a, b) => a.localeCompare(b))

const filterPrefixSuggestions = (
  prefixMap: Record<string, string>,
  token?: AutocompletionToken
): string[] => {
  const suggestions = buildPrefixSuggestions(prefixMap)
  if (!token) return suggestions.slice(0, MAX_SUGGESTIONS)
  const search = getTokenSearchText(token).toLowerCase().trim()
  if (!search) return suggestions.slice(0, MAX_SUGGESTIONS)
  return suggestions
    .filter((item) => item.toLowerCase().includes(search))
    .slice(0, MAX_SUGGESTIONS)
}

const filterIriSuggestions = (
  candidates: string[],
  token?: AutocompletionToken
): string[] => {
  if (!candidates.length) return []
  const search = getTokenSearchText(token).toLowerCase()
  if (!search) return candidates.slice(0, MAX_SUGGESTIONS)
  return candidates
    .filter((candidate) => candidate.toLowerCase().includes(search))
    .slice(0, MAX_SUGGESTIONS)
}

const QueryEditor = ({
  prefixes = {},
  value,
  onChange,
  activeTabId = ''
}: QueryEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const yasqeRef = useRef<Yasqe | null>(null)
  const [height, setHeight] = useState<number>(320)
  const initializedRef = useRef<boolean>(false)
  const propertiesRef = useRef<string[]>([])
  const classesRef = useRef<string[]>([])
  const prefixMapRef = useRef<Record<string, string>>(prefixes)
  const autocompletersRegisteredRef = useRef<boolean>(false)
  const baseCompletersRef = useRef<{
    prefixes?: CompleterConfig
    property?: CompleterConfig
    class?: CompleterConfig
  }>({})
  const initialValueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const lastActiveTabIdRef = useRef<string | null>(null)
  const cursorPositionsRef = useRef<
    Record<string, { line: number; ch: number }>
  >({})
  const [autocompleteError, setAutocompleteError] = useState<string | null>(
    null
  )
  const [autocompleteRetryToken, setAutocompleteRetryToken] = useState(0)

  useEffect(() => {
    prefixMapRef.current = prefixes
  }, [prefixes])

  useEffect(() => {
    if (!initializedRef.current) {
      initialValueRef.current = value
    }
  }, [value])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const loadAutocompleteSources = useCallback(async (_retryToken: number) => {
    setAutocompleteError(null)
    const failures: string[] = []

    await Promise.all([
      (async () => {
        try {
          const response = await fetch('/api/properties')
          if (!response.ok) {
            throw new Error(`properties endpoint returned ${response.status}`)
          }
          const data = await response.json()
          propertiesRef.current = Array.from(
            new Set((data as string[]).filter(Boolean))
          )
        } catch (error) {
          failures.push('property names')
          console.error('Failed to fetch properties:', error)
        }
      })(),
      (async () => {
        try {
          const response = await fetch('/api/classes')
          if (!response.ok) {
            throw new Error(`classes endpoint returned ${response.status}`)
          }
          const data = await response.json()
          classesRef.current = Array.from(
            new Set((data as string[]).filter(Boolean))
          )
        } catch (error) {
          failures.push('class names')
          console.error('Failed to fetch classes:', error)
        }
      })()
    ])

    if (failures.length > 0) {
      setAutocompleteError(
        `Could not load ${failures.join(' and ')} for autocomplete.`
      )
    }
  }, [])

  useEffect(() => {
    void loadAutocompleteSources(autocompleteRetryToken)
  }, [loadAutocompleteSources, autocompleteRetryToken])

  useEffect(() => {
    if (autocompletersRegisteredRef.current) return

    const basePrefixes = Yasqe.Autocompleters.prefixes
    const baseProperty = Yasqe.Autocompleters.property
    const baseClass = Yasqe.Autocompleters.class

    if (!basePrefixes || !baseProperty || !baseClass) {
      return
    }

    const basePrefixCompleter = {
      ...basePrefixes
    }
    const basePropertyCompleter = {
      ...baseProperty
    }
    const baseClassCompleter = {
      ...baseClass
    }

    baseCompletersRef.current = {
      prefixes: basePrefixCompleter,
      property: basePropertyCompleter,
      class: baseClassCompleter
    }

    const prefixCompleter: CompleterConfig = {
      ...basePrefixCompleter,
      bulk: false,
      get: (_yasqe, token) =>
        filterPrefixSuggestions(prefixMapRef.current, token)
    }

    const propertyCompleter: CompleterConfig = {
      ...basePropertyCompleter,
      bulk: false,
      get: (_yasqe, token) => filterIriSuggestions(propertiesRef.current, token)
    }

    const classCompleter: CompleterConfig = {
      ...baseClassCompleter,
      bulk: false,
      get: (_yasqe, token) => filterIriSuggestions(classesRef.current, token)
    }

    Yasqe.registerAutocompleter(prefixCompleter)
    Yasqe.registerAutocompleter(propertyCompleter)
    Yasqe.registerAutocompleter(classCompleter)

    autocompletersRegisteredRef.current = true

    return () => {
      const {
        prefixes: originalPrefixes,
        property: originalProperty,
        class: originalClass
      } = baseCompletersRef.current

      if (originalPrefixes) {
        Yasqe.registerAutocompleter(originalPrefixes)
      }
      if (originalProperty) {
        Yasqe.registerAutocompleter(originalProperty)
      }
      if (originalClass) {
        Yasqe.registerAutocompleter(originalClass)
      }
      autocompletersRegisteredRef.current = false
    }
  }, [])

  useEffect(() => {
    // Only initialize the editor once
    if (initializedRef.current || !editorRef.current) return
    initializedRef.current = true

    // Configure Yasqe defaults
    Yasqe.defaults = {
      ...Yasqe.defaults,
      extraKeys: {
        ...Yasqe.defaults.extraKeys,
        'Cmd-/': (_yasqe: Yasqe) => {
          const yasqe: Yasqe = _yasqe
          yasqe.commentLines()
        }
      },
      value: '',
      showQueryButton: false,
      queryingDisabled: 'Querying disabled',
      resizeable: false,
      editorHeight: '100%',
      persistenceId: null
    }

    // Initialize the editor
    const yasqe = new Yasqe(editorRef.current, {
      createShareableLink: false
    })

    // Set the initial value
    yasqe.setValue(initialValueRef.current)
    yasqe.focus()

    // Store the editor instance
    yasqeRef.current = yasqe

    // Setup change handler
    yasqe.on('change', () => {
      onChangeRef.current?.(yasqe)
    })

    // Cleanup on unmount
    return () => {
      yasqe.destroy()
      yasqeRef.current = null
      initializedRef.current = false
    }
  }, []) // Only run once on mount

  // Update editor value when prop changes and differs from current value,
  // preserving the cursor position per tab so switching tabs does not
  // remount or reset the caret.
  useEffect(() => {
    const yasqe = yasqeRef.current
    if (!yasqe) return

    if (yasqe.getValue() === value) {
      lastActiveTabIdRef.current = activeTabId
      return
    }

    const previousTabId = lastActiveTabIdRef.current
    if (previousTabId) {
      cursorPositionsRef.current[previousTabId] = yasqe.getCursor()
    }

    yasqe.setValue(value)

    const savedCursor = cursorPositionsRef.current[activeTabId]
    if (savedCursor) {
      yasqe.setCursor(savedCursor)
    }

    lastActiveTabIdRef.current = activeTabId
  }, [value, activeTabId])

  // Handle resize
  const handleResize = (
    _event: React.SyntheticEvent,
    { size }: ResizeCallbackData
  ): void => {
    setHeight(size.height)
  }

  const handleFormat = () => {
    const yasqe = yasqeRef.current
    if (!yasqe) return
    yasqe.autoformat()
    toast.success('Query formatted')
  }

  const handleCheckSyntax = () => {
    const yasqe = yasqeRef.current
    if (!yasqe) return
    yasqe.checkSyntax()
    if (yasqe.queryValid) {
      toast.success('No syntax errors found')
    } else {
      toast.error('Syntax errors found', {
        description: 'Errors are marked in the editor gutter.'
      })
    }
  }

  return (
    <ResizableBox
      width={Infinity}
      height={height}
      minConstraints={[Infinity, 200]}
      maxConstraints={[Infinity, 800]}
      resizeHandles={['s']}
      onResize={handleResize}
      handle={
        <div className="m-0.5 flex h-2 w-full cursor-ns-resize items-center justify-center opacity-0 transition-opacity hover:opacity-100">
          <div className="h-1 w-1/3 rounded-full bg-gray-400 dark:bg-gray-500"></div>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b bg-muted/30 px-2 py-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFormat}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            <Braces className="size-3.5" />
            Format
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCheckSyntax}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            <ScanSearch className="size-3.5" />
            Check
          </Button>
          <div className="ml-auto flex items-center gap-1">
            {autocompleteError && (
              <>
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="size-3.5" />
                  Autocomplete data unavailable
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setAutocompleteRetryToken((token) => token + 1)
                  }
                  className="h-7 gap-1 px-2 text-xs"
                  title={autocompleteError}
                >
                  <RefreshCw className="size-3.5" />
                  Retry
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <div ref={editorRef} className="size-full" />
        </div>
      </div>
    </ResizableBox>
  )
}

export default memo(QueryEditor, (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.activeTabId === nextProps.activeTabId &&
    JSON.stringify(prevProps.prefixes) === JSON.stringify(nextProps.prefixes)
  )
})
