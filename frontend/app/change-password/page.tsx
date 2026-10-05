import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import RDFIcon from '@/components/rdf-icon'
import { Card } from '@/components/ui/card'
import { safeInternalRedirect } from '@/config/access'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getWorkbenchName } from '@/lib/runtime/config'

export const metadata: Metadata = {
  title: 'Change password',
  description: 'Set a new password for your account'
}

export default async function ChangePasswordPage({
  searchParams
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect: requestedRedirect } = await searchParams

  // Guarded inline on purpose: requirePageAccess now redirects every
  // flagged principal here, so this page — the one surface a flagged
  // principal must reach — checks its principal itself. Flagged and
  // unflagged logged-in users both proceed; anonymous visitors do not.
  const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
  if (!principal) redirect('/login')

  const appName = getWorkbenchName()
  const redirectTarget = safeInternalRedirect(requestedRedirect)

  return (
    <div className="flex flex-col h-screen w-full bg-linear-to-br from-background to-secondary/20">
      <header className="py-5 px-6 flex items-center">
        <div className="flex items-center space-x-2">
          <RDFIcon className="size-5" />
          <span className="text-base font-semibold">{appName}</span>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Change password
            </h1>
            <p className="text-muted-foreground">
              Set a new password to continue
            </p>
          </div>
          <Card className="p-6 rounded-none sm:rounded-xl">
            <ChangePasswordForm redirectTarget={redirectTarget} />
          </Card>
        </div>
      </div>
    </div>
  )
}
