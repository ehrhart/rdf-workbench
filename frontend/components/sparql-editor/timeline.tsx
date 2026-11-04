'use client'

import { format } from 'date-fns'
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

export interface TimelineEvent {
  id: string
  title: string
  date: Date
  description?: string
  source?: unknown
}

interface TimelineProps {
  events: TimelineEvent[]
}

export function Timeline({ events }: TimelineProps) {
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)

  return (
    <div className="relative">
      <div className="bg-muted-foreground/20 absolute top-0 bottom-0 left-4 w-0.5" />

      <div className="relative space-y-8">
        {events.map((event) => (
          <div key={event.id} className="relative pl-10">
            <div className="bg-primary absolute left-[14px] mt-2 h-2 w-2 -translate-x-1/2 transform rounded-full" />

            <Card
              className={`cursor-pointer transition-all ${selectedEvent === event.id ? 'border-primary' : ''}`}
              onClick={() =>
                setSelectedEvent(event.id === selectedEvent ? null : event.id)
              }
            >
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">{event.title}</CardTitle>
                <CardDescription>{format(event.date, 'PPP')}</CardDescription>
              </CardHeader>
              {(event.description || selectedEvent === event.id) && (
                <CardContent className="p-4 pt-0">
                  {event.description && (
                    <p className="text-sm">{event.description}</p>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
