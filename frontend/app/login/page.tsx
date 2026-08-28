import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'
import RDFIcon from '@/components/rdf-icon'
import { Card } from '@/components/ui/card'
import { getWorkbenchName } from '@/lib/runtime/config'

export const metadata: Metadata = {
  title: 'Login',
  description: 'Login to your account'
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: { redirect?: string }
}) {
  const { redirect } = await searchParams
  const appName = getWorkbenchName()
  return (
    <div className="flex flex-col h-screen w-full bg-linear-to-br from-background to-secondary/20">
      <header className="py-5 px-6 flex items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2 group">
          <RDFIcon className="size-5" />
          <span className="text-base font-semibold">{appName}</span>
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Login
            </h1>
            <p className="text-muted-foreground">
              Enter your credentials to access your account
            </p>
          </div>
          <Card className="p-6 rounded-none sm:rounded-xl">
            <LoginForm redirectUrl={redirect} />
          </Card>
        </div>
      </div>
    </div>
  )
}
