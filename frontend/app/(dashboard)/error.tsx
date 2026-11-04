'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { isAuthFailureCopy } from '@/lib/auth-error-copy'

interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const router = useRouter()

  useEffect(() => {
    if (isAuthFailureCopy(error)) {
      router.replace('/logout')
      return
    }

    console.error('Dashboard error boundary caught error:', error)
  }, [error, router])

  if (isAuthFailureCopy(error)) {
    return null
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 py-12 text-center">
      <h2 className="text-xl font-semibold">This page couldn&apos;t load</h2>
      <p className="text-muted-foreground text-sm">
        {error?.message || 'No details available.'}
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
