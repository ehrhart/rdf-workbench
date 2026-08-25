'use client'

import '@zazuko/yasgui/build/yasgui.min.css'
import Yasqe from '@zazuko/yasqe'
import type {
  AutocompletionToken,
  CompleterConfig
} from '@zazuko/yasqe/build/ts/src/autocompleters'
import { Braces, ScanSearch } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { ResizableBox, type ResizeCallbackData } from 'react-resizable'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface QueryEditorProps {
  prefixes?: Record<string, string>
  value: string
  onChange?: (yasqe: Yasqe) => void
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

const QueryEditor = ({ prefixes = {}, value, onChange }: QueryEditorProps) => {
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

  useEffect(() => {
    // Fetch properties from API
    const fetchProps = async () => {
      try {
        const response = await fetch('/api/properties')
        if (response.ok) {
          const data = await response.json()
          propertiesRef.current = Array.from(
            new Set((data as string[]).filter(Boolean))
          )
        }
      } catch (error) {
        console.error('Failed to fetch properties:', error)
      }
    }

    // Fetch classes from API
    const fetchCls = async () => {
      try {
        const response = await fetch('/api/classes')
        if (response.ok) {
          const data = await response.json()
          classesRef.current = Array.from(
            new Set((data as string[]).filter(Boolean))
          )
        }
      } catch (error) {
        console.error('Failed to fetch classes:', error)
      }
    }

    fetchProps()
    fetchCls()
  }, []) // Empty dependency array - only run once on mount

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

  // Update editor value when prop changes and differs from current value
  useEffect(() => {
    const yasqe = yasqeRef.current
    if (yasqe && yasqe.getValue() !== value) {
      yasqe.setValue(value)
    }
  }, [value])

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
    JSON.stringify(prevProps.prefixes) === JSON.stringify(nextProps.prefixes)
  )
})
