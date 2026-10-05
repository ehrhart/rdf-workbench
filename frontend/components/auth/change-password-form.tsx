'use client'

import { useActionState } from 'react'
import { changePasswordAction } from '@/app/change-password/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PASSWORD_MIN_LENGTH } from '@/lib/definitions'

export function ChangePasswordForm({
  redirectTarget
}: {
  redirectTarget: string
}) {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    undefined
  )

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="redirect" value={redirectTarget} />
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
          minLength={PASSWORD_MIN_LENGTH}
          autoFocus
          autoComplete="new-password"
          disabled={pending}
        />
        {state?.errors?.newPassword && (
          <p className="text-sm text-destructive">
            {state.errors.newPassword[0]}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          disabled={pending}
        />
        {state?.errors?.confirmPassword && (
          <p className="text-sm text-destructive">
            {state.errors.confirmPassword[0]}
          </p>
        )}
      </div>

      {state?.message && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving...' : 'Set new password'}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        The new password must be at least {PASSWORD_MIN_LENGTH} characters.{' '}
        {/* A plain anchor on purpose: a prefetching Link to the /logout
            route handler would run the logout on prefetch. */}
        <a
          href="/logout"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Log out
        </a>
      </p>
    </form>
  )
}
