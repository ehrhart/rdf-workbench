'use client'

import { Clock, Database } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { QueryHistory } from '@/components/query/query-history'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isqlQueryHistoryService } from '@/lib/client/query-history'
import { IsqlEditor } from './isql-editor'

interface IsqlConsoleProps {
  defaultQuery?: string
}

export function IsqlConsole({ defaultQuery }: IsqlConsoleProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>('editor')

  return (
    <div className="flex items-center justify-between">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="overflow-x-auto justify-start mb-2">
          <TabsTrigger value="editor" className="flex items-center gap-2">
            <Database />
            ISQL Console
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock />
            Query History
          </TabsTrigger>
        </TabsList>

        <div>
          <TabsContent value="editor" className="h-full">
            <IsqlEditor defaultQuery={defaultQuery} />
          </TabsContent>

          <TabsContent value="history" className="h-full">
            <QueryHistory
              service={isqlQueryHistoryService}
              queryNoun="ISQL command"
              emptyHistoryMessage="Run an ISQL command and it will be saved here for quick access."
              onSelectQueryAction={(query) => {
                setActiveTab('editor')
                router.push(`/isql?query=${encodeURIComponent(query)}`)
              }}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
