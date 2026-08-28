'use client'

import {
  CopyIcon,
  DownloadIcon,
  EditIcon,
  PlayIcon,
  PlusIcon,
  UndoIcon,
  XIcon
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { toast } from 'sonner'
import { SavedQueriesMenu } from '@/components/sparql-editor/saved-queries-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { QueryHistoryService } from '@/lib/client/query-history'
import { fetchSavedQuery } from '@/lib/client/saved-queries'
import { cn } from '@/lib/utils'
import type { SavedQuery } from '@/types'
import { Spinner } from '../sparql-editor/spinner'
import { Input } from '../ui/input'
import { Kbd } from '../ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

export interface QueryTab {
  id: string
  name: string
  query: string
}

export interface QueryWorkbenchRunner<TResults> {
  results: TResults | null
  isLoading: boolean
  error: Error | null
  executeQuery: (query: string) => Promise<{
    data: TResults | null
    error: Error | null
  }>
  downloadResults?: (request: DownloadRequest<TResults>) => Promise<void> | void
  abortQuery?: () => Promise<void> | void
}

export interface DownloadRequest<TResults> {
  query?: string
  format: string
  filename?: string
  results?: TResults | null
}

export interface QueryEditorRenderProps {
  value: string
  onChange: (value: string) => void
  activeTabId: string
}

export interface QueryResultView<TResults> {
  id: string
  label: string
  render: (results: TResults) => ReactNode
}

interface UrlSyncOptions {
  enabled?: boolean
  paramKey?: string
}

export interface QueryWorkbenchProps<TResults> {
  storageNamespace: string
  defaultQuery?: string
  historyService: QueryHistoryService
  runner: QueryWorkbenchRunner<TResults>
  renderEditor: (props: QueryEditorRenderProps) => ReactNode
  resultViews?: QueryResultView<TResults>[]
  initialResultViewId?: string
  queryNoun?: string
  runButtonLabel?: string
  exportButtonLabel?: string
  exportFilename?: string
  emptyResultsMessage?: string
  urlSync?: UrlSyncOptions
  exportGroups?: ExportGroup[]
  enableSavedQueries?: boolean
  currentUser?: { id: string; username: string } | null
}

const DEFAULT_QUERY_NOUN = 'query'
const DEFAULT_PARAM_KEY = 'query'

export interface ExportFormat {
  label: string
  mime: string
  extension: string
  type?: 'results' | 'query'
}

export interface ExportGroup {
  label?: string
  formats: ExportFormat[]
  isEnabled?: (query: string) => boolean
}

const DEFAULT_EXPORT_GROUPS: ExportGroup[] = [
  {
    label: 'Results',
    formats: [
      {
        label: 'JSON',
        mime: 'application/json',
        extension: 'json'
      }
    ]
  }
]

export function QueryWorkbench<TResults>({
  storageNamespace,
  defaultQuery = '',
  historyService,
  runner,
  renderEditor,
  resultViews = [],
  initialResultViewId,
  queryNoun = DEFAULT_QUERY_NOUN,
  runButtonLabel = 'Run Query',
  exportButtonLabel = 'Export',
  exportFilename,
  emptyResultsMessage = 'No results to display',
  urlSync,
  exportGroups,
  enableSavedQueries = false,
  currentUser = null
}: QueryWorkbenchProps<TResults>) {
  const tabsStorageKey = `${storageNamespace}-tabs`
  const activeTabStorageKey = `${storageNamespace}-active-tab`
  const [tabs, setTabs] = useState<QueryTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingTabName, setEditingTabName] = useState<string>('')
  const [activeView, setActiveView] = useState<string>(
    initialResultViewId ?? resultViews[0]?.id ?? 'table'
  )
  const [closedTabs, setClosedTabs] = useState<QueryTab[]>([])
  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null)
  const [tabResults, setTabResults] = useState<Record<string, TResults | null>>(
    {}
  )
  const [tabErrors, setTabErrors] = useState<Record<string, Error | null>>({})
  const [loadingTabIds, setLoadingTabIds] = useState<Set<string>>(new Set())
  const [lastExecutedQuery, setLastExecutedQuery] = useState<
    Record<string, string>
  >({})
  const [executionTimes, setExecutionTimes] = useState<Record<string, number>>(
    {}
  )
  const [queryStartTimes, setQueryStartTimes] = useState<
    Record<string, number>
  >({})
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  const [isExporting, setIsExporting] = useState(false)
  const initializedRef = useRef<boolean>(false)

  const searchParams = useSearchParams()
  const urlQuery = useMemo(() => {
    if (!urlSync?.enabled) return null
    const param = urlSync.paramKey ?? DEFAULT_PARAM_KEY
    return searchParams.get(param)
  }, [searchParams, urlSync?.enabled, urlSync?.paramKey])

  const savedQueryId = useMemo(() => {
    if (!urlSync?.enabled) return null
    return searchParams.get('savedQueryId')
  }, [searchParams, urlSync?.enabled])

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null
  const currentResults = activeTabId ? (tabResults[activeTabId] ?? null) : null
  const currentError = activeTabId ? (tabErrors[activeTabId] ?? null) : null
  const isTabLoading = activeTabId ? loadingTabIds.has(activeTabId) : false
  const effectiveExportGroups = useMemo(
    () => exportGroups ?? DEFAULT_EXPORT_GROUPS,
    [exportGroups]
  )
  const availableExportGroups = useMemo(() => {
    const queryValue = activeTab?.query ?? ''
    return effectiveExportGroups.filter((group) =>
      group.isEnabled ? group.isEnabled(queryValue) : true
    )
  }, [activeTab?.query, effectiveExportGroups])

  const exportButtonDisabled =
    (!activeTab?.query?.trim() && !currentResults) ||
    isTabLoading ||
    isExporting ||
    availableExportGroups.length === 0
  const exportFilenameBase = exportFilename ?? `${storageNamespace}-results`

  const createTab = useCallback(
    (name: string, query = ''): QueryTab => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      query
    }),
    []
  )

  const createDefaultTab = useCallback(() => {
    const newTab = createTab('New Query', defaultQuery)
    setTabs([newTab])
    setActiveTabId(newTab.id)
    return newTab
  }, [createTab, defaultQuery])

  const addTab = useCallback(
    (query = '', name?: string) => {
      const newTab = createTab(name ?? `Query ${tabs.length + 1}`, query)
      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
      return newTab
    },
    [createTab, tabs.length]
  )

  const closeTab = useCallback(
    (tabId: string) => {
      const tabToClose = tabs.find((tab) => tab.id === tabId)
      if (!tabToClose) return

      if (tabToClose.query.trim() !== '') {
        const confirmClose = window.confirm(
          `Are you sure you want to close "${tabToClose.name}"? It has unsaved ${queryNoun}s.`
        )
        if (!confirmClose) return
      }

      setTabs((prev) => {
        setClosedTabs((prevClosed) => [tabToClose, ...prevClosed.slice(0, 9)])
        const newTabs = prev.filter((tab) => tab.id !== tabId)

        if (newTabs.length === 0) {
          const fallback = createTab('New Query', defaultQuery)
          setActiveTabId(fallback.id)
          return [fallback]
        }

        if (activeTabId === tabId) {
          const tabIndex = prev.findIndex((tab) => tab.id === tabId)
          const newActiveIndex = Math.min(tabIndex, newTabs.length - 1)
          setActiveTabId(newTabs[newActiveIndex]?.id ?? newTabs[0].id)
        }

        return newTabs
      })
    },
    [tabs, activeTabId, createTab, defaultQuery, queryNoun]
  )

  const closeOtherTabs = useCallback((tabId: string) => {
    setTabs((prev) => {
      const tabToKeep = prev.find((tab) => tab.id === tabId)
      if (!tabToKeep) return prev

      const tabsToClose = prev.filter((tab) => tab.id !== tabId)
      if (tabsToClose.length > 0) {
        setClosedTabs((prevClosed) => [
          ...tabsToClose,
          ...prevClosed.slice(0, Math.max(0, 10 - tabsToClose.length))
        ])
      }

      setActiveTabId(tabToKeep.id)
      return [tabToKeep]
    })
  }, [])

  const duplicateTab = useCallback(
    (tabId: string) => {
      const tabToDuplicate = tabs.find((tab) => tab.id === tabId)
      if (!tabToDuplicate) return

      const newTab = createTab(
        `${tabToDuplicate.name} (copy)`,
        tabToDuplicate.query
      )
      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
    },
    [createTab, tabs]
  )

  const undoCloseTab = useCallback(() => {
    if (closedTabs.length === 0) return
    const [tabToRestore, ...remainingClosedTabs] = closedTabs
    setClosedTabs(remainingClosedTabs)
    setTabs((prev) => [...prev, tabToRestore])
    setActiveTabId(tabToRestore.id)
  }, [closedTabs])

  const startEditingTabName = useCallback(
    (tabId: string, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation()
      }
      const tab = tabs.find((t) => t.id === tabId)
      if (tab) {
        setEditingTabId(tabId)
        setEditingTabName(tab.name)
      }
    },
    [tabs]
  )

  const saveTabName = useCallback(() => {
    if (!editingTabId) return
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === editingTabId
          ? { ...tab, name: editingTabName || `Query ${prev.indexOf(tab) + 1}` }
          : tab
      )
    )
    setEditingTabId(null)
  }, [editingTabId, editingTabName])

  const handleTabChange = useCallback(
    (tabId: string) => {
      if (activeTabId === tabId) return
      setActiveTabId(tabId)
    },
    [activeTabId]
  )

  const handleTabRightClick = useCallback(
    (tabId: string, event: React.MouseEvent) => {
      event.preventDefault()
      setContextMenuTabId(tabId)
    },
    []
  )

  const closeContextMenu = useCallback(() => {
    setContextMenuTabId(null)
  }, [])

  const handleExecuteQuery = useCallback(async () => {
    if (!activeTab?.query) return
    const query = activeTab.query
    const startTime = performance.now()
    setQueryStartTimes((prev) => ({ ...prev, [activeTab.id]: startTime }))
    setElapsedTime(0)
    setLoadingTabIds((prev) => new Set(prev).add(activeTab.id))
    setTabErrors((prev) => ({ ...prev, [activeTab.id]: null }))
    const { data, error } = await runner.executeQuery(query)
    const endTime = performance.now()
    const duration = Math.round(endTime - startTime)
    setQueryStartTimes((prev) => {
      const newObj = { ...prev }
      delete newObj[activeTab.id]
      return newObj
    })
    setLoadingTabIds((prev) => {
      const newSet = new Set(prev)
      newSet.delete(activeTab.id)
      return newSet
    })

    if (error) {
      setTabErrors((prev) => ({ ...prev, [activeTab.id]: error }))
      setTabResults((prev) => ({ ...prev, [activeTab.id]: data }))
    } else {
      setTabResults((prev) => ({ ...prev, [activeTab.id]: data }))
      setTabErrors((prev) => ({ ...prev, [activeTab.id]: null }))
      setLastExecutedQuery((prev) => ({ ...prev, [activeTab.id]: query }))
      setExecutionTimes((prev) => ({ ...prev, [activeTab.id]: duration }))
      historyService.save({
        query,
        timestamp: new Date().toISOString(),
        duration
      })
    }
  }, [activeTab, historyService, runner])

  const handleAbortQuery = useCallback(async () => {
    if (!runner.abortQuery || !activeTabId) return

    try {
      await runner.abortQuery()
      setTabErrors((prev) => ({
        ...prev,
        [activeTabId]: new Error('Query aborted')
      }))
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error))
      setTabErrors((prev) => ({ ...prev, [activeTabId]: normalizedError }))
    } finally {
      setQueryStartTimes((prev) => {
        const newObj = { ...prev }
        if (activeTabId) delete newObj[activeTabId]
        return newObj
      })
      setLoadingTabIds((prev) => {
        const newSet = new Set(prev)
        if (activeTabId) newSet.delete(activeTabId)
        return newSet
      })
    }
  }, [runner.abortQuery, activeTabId])

  const handleDownloadResults = useCallback(
    async (format: ExportFormat) => {
      if (!runner.downloadResults || !activeTab) return

      const trimmedQuery = activeTab.query?.trim()
      const fallbackQuery = lastExecutedQuery[activeTab.id]?.trim()
      const queryToUse = trimmedQuery || fallbackQuery
      if (!queryToUse) return

      const filename = `${exportFilenameBase}.${format.extension}`

      if (format.type === 'query') {
        const blob = new Blob([queryToUse], { type: format.mime })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        return
      }

      setIsExporting(true)
      try {
        await runner.downloadResults({
          query: queryToUse,
          format: format.mime,
          filename,
          results: currentResults ?? null
        })
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error))
        setTabErrors((prev) => ({ ...prev, [activeTab.id]: normalizedError }))
      } finally {
        setIsExporting(false)
      }
    },
    [runner, activeTab, currentResults, exportFilenameBase, lastExecutedQuery]
  )

  const handleOpenSavedQuery = useCallback(
    (saved: SavedQuery) => {
      const newTab = addTab(saved.query, saved.name)
      setTabResults((prev) => ({ ...prev, [newTab.id]: null }))
      setTabErrors((prev) => ({ ...prev, [newTab.id]: null }))
    },
    [addTab]
  )

  const handleSavedQuerySaved = useCallback(
    (saved: SavedQuery) => {
      if (!activeTabId) return
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId ? { ...tab, name: saved.name } : tab
        )
      )
    },
    [activeTabId]
  )

  const handleQueryChange = useCallback(
    (query: string) => {
      if (!activeTabId) return
      setTabs((prev) =>
        prev.map((tab) => (tab.id === activeTabId ? { ...tab, query } : tab))
      )
    },
    [activeTabId]
  )

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const initializeTabs = async () => {
      const savedTabsRaw = localStorage.getItem(tabsStorageKey)
      const savedActiveTab = localStorage.getItem(activeTabStorageKey)

      const parsedTabs = savedTabsRaw
        ? (JSON.parse(savedTabsRaw) as QueryTab[])
        : []

      if (savedQueryId) {
        try {
          const saved = await fetchSavedQuery(savedQueryId)
          if (saved) {
            const savedTab = createTab(saved.name || 'Saved Query', saved.query)
            setTabs([...parsedTabs, savedTab])
            setActiveTabId(savedTab.id)
            return
          }
          toast.error('Saved query not found')
        } catch (error) {
          console.error('Failed to load saved query from URL', error)
          toast.error('Unable to load saved query link')
        }
      }

      if (urlQuery) {
        const matchingTab = parsedTabs.find((tab) => tab.query === urlQuery)
        if (matchingTab) {
          setTabs(parsedTabs)
          setActiveTabId(matchingTab.id)
          return
        }

        const urlTab = createTab('URL Query', urlQuery)
        setTabs([...parsedTabs, urlTab])
        setActiveTabId(urlTab.id)
        return
      }

      if (parsedTabs.length > 0) {
        setTabs(parsedTabs)
        if (
          savedActiveTab &&
          parsedTabs.some((tab) => tab.id === savedActiveTab)
        ) {
          setActiveTabId(savedActiveTab)
        } else {
          setActiveTabId(parsedTabs[0].id)
        }
        return
      }

      createDefaultTab()
    }

    void initializeTabs()
  }, [
    urlQuery,
    savedQueryId,
    createDefaultTab,
    createTab,
    tabsStorageKey,
    activeTabStorageKey
  ])

  useEffect(() => {
    if (tabs.length > 0 && activeTabId) {
      localStorage.setItem(tabsStorageKey, JSON.stringify(tabs))
      localStorage.setItem(activeTabStorageKey, activeTabId)
    }
  }, [tabs, activeTabId, tabsStorageKey, activeTabStorageKey])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        void handleExecuteQuery()
      }

      if (event.ctrlKey && /^\d$/.test(event.key)) {
        const tabIndex = Number.parseInt(event.key, 10) - 1
        if (tabIndex >= 0 && tabIndex < tabs.length) {
          event.preventDefault()
          handleTabChange(tabs[tabIndex].id)
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') {
        event.preventDefault()
        addTab()
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
        event.preventDefault()
        if (activeTabId) {
          closeTab(activeTabId)
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Tab') {
        event.preventDefault()
        const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId)
        const targetIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1
        if (targetIndex >= 0 && targetIndex < tabs.length) {
          handleTabChange(tabs[targetIndex].id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleExecuteQuery, tabs, activeTabId, addTab, closeTab, handleTabChange])

  useEffect(() => {
    if (!editingTabId) return
    const inputElement = document.querySelector(
      `div[data-tab-id="${editingTabId}"] input`
    ) as HTMLInputElement | null

    if (inputElement) {
      setTimeout(() => {
        inputElement.focus()
        inputElement.select()
      }, 0)
    }
  }, [editingTabId])

  useEffect(() => {
    if (!activeTabId || !queryStartTimes[activeTabId]) return

    const intervalId = setInterval(() => {
      setElapsedTime(performance.now() - queryStartTimes[activeTabId])
    }, 50)

    return () => clearInterval(intervalId)
  }, [activeTabId, queryStartTimes])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between px-1 gap-2">
        <div className="flex flex-wrap gap-2">
          {isTabLoading && runner.abortQuery ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleAbortQuery()}
              className="transition-all duration-200"
            >
              <XIcon />
              Abort
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleExecuteQuery()}
              disabled={isTabLoading}
              className="bg-primary hover:bg-primary/90 transition-all duration-200"
            >
              {isTabLoading ? <Spinner /> : <PlayIcon />}
              <span className="hidden sm:inline-block">{runButtonLabel}</span>
            </Button>
          )}
          {runner.downloadResults ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exportButtonDisabled}
                  className="hover:bg-primary/10 hover:text-primary hover:border-primary transition-all duration-200"
                >
                  {isExporting ? <Spinner /> : <DownloadIcon />}
                  <span className="hidden sm:inline-block">
                    {isExporting ? 'Exporting…' : exportButtonLabel}
                  </span>
                  <span className="hidden sm:inline-block">▾</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {availableExportGroups.map((group, groupIndex) => (
                  <div key={group.label}>
                    <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                    {group.formats.map((format) => (
                      <DropdownMenuItem
                        key={`${group.label}-${format.mime}`}
                        disabled={exportButtonDisabled}
                        onClick={() => void handleDownloadResults(format)}
                      >
                        {format.label}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {format.extension}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    {groupIndex < availableExportGroups.length - 1 ? (
                      <DropdownMenuSeparator />
                    ) : null}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {enableSavedQueries ? (
            <SavedQueriesMenu
              currentUser={currentUser}
              activeTabName={activeTab?.name ?? 'New Query'}
              activeQuery={activeTab?.query ?? ''}
              onOpenSavedQuery={handleOpenSavedQuery}
              onSaved={handleSavedQuerySaved}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <div className="bg-muted/50 flex items-center rounded-t-lg border p-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 overflow-x-auto">
              {tabs.map((tab) => (
                <DropdownMenu
                  key={tab.id}
                  open={contextMenuTabId === tab.id}
                  onOpenChange={closeContextMenu}
                >
                  <DropdownMenuTrigger asChild>
                    <div
                      role="tab"
                      tabIndex={0}
                      className={cn(
                        'flex cursor-pointer items-center rounded-lg px-4 py-2.5 transition-all duration-200',
                        activeTabId === tab.id
                          ? 'bg-background hover:bg-background font-medium'
                          : 'bg-muted/50 hover:bg-muted'
                      )}
                      onClick={() => handleTabChange(tab.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          handleTabChange(tab.id)
                        }
                        if (e.key === 'F10' && e.shiftKey) {
                          e.preventDefault()
                          setContextMenuTabId(tab.id)
                        }
                      }}
                      onDoubleClick={(e) =>
                        !editingTabId && startEditingTabName(tab.id, e)
                      }
                      onContextMenu={(e) =>
                        !editingTabId && handleTabRightClick(tab.id, e)
                      }
                      data-tab-id={tab.id}
                    >
                      {editingTabId === tab.id ? (
                        <Input
                          className="h-6 w-30 px-1 py-0"
                          type="text"
                          placeholder="Tab name"
                          value={editingTabName}
                          onChange={(e) => setEditingTabName(e.target.value)}
                          onBlur={saveTabName}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Enter') saveTabName()
                            if (e.key === 'Escape') setEditingTabId(null)
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="mr-2 max-w-[150px] truncate text-sm">
                                {tab.name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{tab.name}</TooltipContent>
                          </Tooltip>
                          {loadingTabIds.has(tab.id) && (
                            <Spinner className="h-4 w-4 mr-1" />
                          )}
                          <button
                            type="button"
                            className="hover:bg-destructive/10 hover:text-destructive ml-1 rounded-md p-0.5 opacity-50 transition-all hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              closeTab(tab.id)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation()
                                closeTab(tab.id)
                              }
                            }}
                          >
                            <XIcon size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => addTab()}>
                      <PlusIcon />
                      New Tab
                      <Kbd>⌘/Ctrl+T</Kbd>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => startEditingTabName(tab.id)}
                    >
                      <EditIcon />
                      Rename Tab
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicateTab(tab.id)}>
                      <CopyIcon />
                      Duplicate Tab
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => closeTab(tab.id)}>
                      <XIcon />
                      Close Tab
                      <Kbd>Ctrl+W</Kbd>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => closeOtherTabs(tab.id)}>
                      <XIcon />
                      Close Other Tabs
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={undoCloseTab}
                      disabled={closedTabs.length === 0}
                    >
                      <UndoIcon />
                      Undo Close Tab
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-primary/10 hover:text-primary transition-all duration-200"
                onClick={() => addTab()}
              >
                <PlusIcon size={16} />
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-b-xl border border-t-0 p-0">
            {activeTab &&
              renderEditor({
                value: activeTab.query,
                onChange: handleQueryChange,
                activeTabId
              })}
          </div>
        </div>

        {currentResults || isTabLoading || currentError ? (
          <div className="flex flex-col">
            {currentError ? (
              <div className="px-2 text-red-500">
                <h3 className="font-bold">Error</h3>
                <pre className="whitespace-pre-wrap">
                  {currentError.message}
                </pre>
              </div>
            ) : isTabLoading ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 p-10">
                <div className="flex items-center gap-2">
                  <Spinner className="h-8 w-8" />
                  <span>Executing {queryNoun}...</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {(elapsedTime / 1000).toFixed(2)}s
                </div>
              </div>
            ) : currentResults ? (
              <>
                {activeTabId && executionTimes[activeTabId] !== undefined && (
                  <div className="mb-2 px-2 text-sm text-muted-foreground">
                    Query executed in{' '}
                    <span className="font-medium text-foreground">
                      {(executionTimes[activeTabId] / 1000).toFixed(3)}s
                    </span>
                  </div>
                )}
                {resultViews.length > 0 ? (
                  <Tabs
                    value={activeView}
                    onValueChange={setActiveView}
                    className="flex flex-1 flex-col"
                  >
                    <div>
                      <TabsList>
                        {resultViews.map((view) => (
                          <TabsTrigger key={view.id} value={view.id}>
                            {view.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>

                    {resultViews.map((view) => (
                      <TabsContent
                        key={view.id}
                        value={view.id}
                        className="m-0 flex-1 p-0"
                      >
                        {view.render(currentResults as TResults)}
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  <div className="p-4 text-muted-foreground">
                    {emptyResultsMessage}
                  </div>
                )}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
