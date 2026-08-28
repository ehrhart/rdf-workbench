'use client'

import { useState } from 'react'
import { abortQuery as abortRunningQuery } from '@/app/(dashboard)/monitor/queries/actions'

export function useAbortQuery() {
  const [error, setError] = useState<Error | null>(null)

  const abortQuery = async (queryId?: string): Promise<void> => {
    try {
      await abortRunningQuery(queryId)
    } catch (err) {
      const normalizedError =
        err instanceof Error ? err : new Error(String(err))
      setError(normalizedError)
      throw normalizedError
    }
  }

  return {
    abortQuery,
    error
  }
}
