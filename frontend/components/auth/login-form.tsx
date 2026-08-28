'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm({ redirectUrl }: { redirectUrl?: string }) {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <form action={action} className="space-y-4">
      {redirectUrl && (
        <input type="hidden" name="redirect" value={redirectUrl} />
      )}
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          placeholder="username (e.g. dba)"
          autoFocus
          autoComplete="username"
          disabled={pending}
        />
        {state?.errors?.username && (
          <p className="text-sm text-destructive">{state.errors.username[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="•••"
          autoComplete="current-password"
          disabled={pending}
        />
        {state?.errors?.password && (
          <p className="text-sm text-destructive">{state.errors.password[0]}</p>
        )}
      </div>

      {state?.message && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Logging in...' : 'Login'}
      </Button>
    </form>
  )
}
