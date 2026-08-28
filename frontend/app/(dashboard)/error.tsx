'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const router = useRouter()

  useEffect(() => {
    const message = error?.message || ''
    const isAuth =
      error?.name === 'AuthError' ||
      message.includes('Session expired') ||
      message.includes('Your session has expired') ||
      message.toLowerCase().includes('unauthorized')

    if (isAuth) {
      // Clear session and redirect to login
      router.replace('/logout')
      return
    }

    console.error('Dashboard error boundary caught error:', error)
  }, [error, router])

  const message = error?.message || ''
  const isAuth =
    error?.name === 'AuthError' ||
    message.includes('Session expired') ||
    message.includes('Your session has expired') ||
    message.toLowerCase().includes('unauthorized')

  // Don't show UI for auth errors, just redirect
  if (isAuth) {
    return null
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 py-12 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground text-sm">
        {error?.message || 'An unexpected error occurred.'}
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
