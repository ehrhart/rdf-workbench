'use client'

import { Clock, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { QueryHistory } from '@/components/query/query-history'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DownloadFormat } from '@/lib/runtime/contracts'
import type { User } from '@/types'
import SparqlEditor from '../sparql-editor/sparql-editor'

interface QueryConsoleProps {
  prefixes: Record<string, string>
  defaultQuery?: string
  user?: User | null
  downloadFormats: {
    select: readonly DownloadFormat[]
    ask: readonly DownloadFormat[]
    graph: readonly DownloadFormat[]
  }
}

export function QueryConsole({
  prefixes,
  defaultQuery,
  user,
  downloadFormats
}: QueryConsoleProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>('editor')

  return (
    <div className="flex items-center justify-between">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="overflow-x-auto justify-start mb-2">
          <TabsTrigger value="editor" className="flex items-center gap-2">
            <Play />
            Query Editor
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock />
            Query History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="h-full">
          <div className="">
            <SparqlEditor
              endpoint="/api/sparql"
              prefixes={prefixes}
              defaultQuery={defaultQuery}
              currentUser={user ?? null}
              downloadFormats={downloadFormats}
            />
          </div>
        </TabsContent>

        <TabsContent value="history" className="h-full">
          <QueryHistory
            onSelectQueryAction={(query) => {
              setActiveTab('editor')
              router.push(`/sparql?query=${encodeURIComponent(query)}`)
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
