import { redirect } from 'next/navigation'
import type React from 'react'
import { getWorkbenchRuntime } from '@/lib/runtime'

export const dynamic = 'force-dynamic'

export default async function MonitorLayout({
  children
}: {
  children: React.ReactNode
}) {
  const runtime = await getWorkbenchRuntime()
  const principal = await runtime.auth.getPrincipal()
  if (!principal) redirect('/logout?redirect=/monitor')
  if (
    (runtime.provider === 'qlever' || runtime.provider === 'oxigraph') &&
    principal.role !== 'admin'
  ) {
    redirect('/logout?redirect=/monitor')
  }
  return children
}
