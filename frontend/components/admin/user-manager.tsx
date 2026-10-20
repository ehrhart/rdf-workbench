'use client'

import { Loader2Icon, UserPlusIcon } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import {
  createUserAction,
  resetUserPasswordAction,
  setUserDisabledAction,
  setUserRoleAction
} from '@/app/(dashboard)/admin/users/actions'
import {
  type PasswordReveal,
  TemporaryPasswordDialog
} from '@/components/admin/temporary-password-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { PASSWORD_CHANGE_PATH } from '@/config/access'
import { PASSWORD_MIN_LENGTH } from '@/lib/definitions'
import type { CreateUserInput, LocalUser } from '@/lib/local-auth'

interface UserManagerProps {
  users: LocalUser[]
  currentUserId: string
}

export function UserManager({ users, currentUserId }: UserManagerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, setPending] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState(false)
  const [reveal, setReveal] = useState<PasswordReveal | null>(null)

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const username = String(data.get('username') ?? '')
    const role = data.get('role') === 'admin' ? 'admin' : 'user'
    const input: CreateUserInput = temporaryPassword
      ? { mode: 'temporary', username, role }
      : {
          mode: 'manual',
          username,
          password: String(data.get('password') ?? ''),
          role
        }
    setPending('create')
    const result = await createUserAction(input)
    setPending(null)
    if (!result.ok) return toast.error(result.message)
    if (result.mode === 'temporary') {
      setReveal({ username, password: result.oneTimePassword })
    } else {
      toast.success(result.message)
    }
    form.reset()
    setTemporaryPassword(false)
    router.refresh()
  }

  async function toggleUser(user: LocalUser) {
    setPending(user.id)
    const result = await setUserDisabledAction(user.id, !user.disabled)
    setPending(null)
    if (!result.ok) return toast.error(result.message)
    toast.success(result.message)
    router.refresh()
  }

  async function changeRole(user: LocalUser, role: 'admin' | 'user') {
    setPending(user.id)
    const result = await setUserRoleAction(user.id, role)
    setPending(null)
    if (!result.ok) return toast.error(result.message)
    toast.success(result.message)
    router.refresh()
  }

  async function resetPassword(user: LocalUser) {
    const confirmed = window.confirm(
      `Reset ${user.username}'s password? Their active sessions end, and they set a new password at the next sign-in.`
    )
    if (!confirmed) return
    setPending(user.id)
    const result = await resetUserPasswordAction(user.id)
    setPending(null)
    if (!result.ok) return toast.error(result.message)
    setReveal({ username: user.username, password: result.oneTimePassword })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create user</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="space-y-4">
            <div
              className={
                temporaryPassword
                  ? 'grid gap-4 md:grid-cols-[1fr_10rem_auto]'
                  : 'grid gap-4 md:grid-cols-[1fr_1fr_10rem_auto]'
              }
            >
              <Input name="username" placeholder="Username" required />
              {!temporaryPassword && (
                <Input
                  name="password"
                  type="password"
                  minLength={PASSWORD_MIN_LENGTH}
                  placeholder={`Password (${PASSWORD_MIN_LENGTH}+ characters)`}
                  required
                />
              )}
              <select
                name="role"
                defaultValue="user"
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
                aria-label="Role"
              >
                <option value="user">User</option>
                <option value="admin">Administrator</option>
              </select>
              <Button type="submit" disabled={pending !== null}>
                {pending === 'create' ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <UserPlusIcon />
                )}
                Create
              </Button>
            </div>
            <div className="flex items-start gap-3">
              <Switch
                id="temporary-password"
                checked={temporaryPassword}
                onCheckedChange={setTemporaryPassword}
                disabled={pending !== null}
              />
              <div className="space-y-1">
                <Label htmlFor="temporary-password">Temporary password</Label>
                <p className="text-muted-foreground text-xs">
                  The user signs in with it once, then sets their own password.
                  They can&apos;t use the workbench until then.
                </p>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Disabling an account or resetting its password signs the user out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.username}
                      {user.id === currentUserId ? ' (you)' : ''}
                    </TableCell>
                    <TableCell className="capitalize">
                      <select
                        value={user.role}
                        className="h-9 rounded-md border bg-transparent px-3 text-sm"
                        aria-label={`Role for ${user.username}`}
                        disabled={pending !== null}
                        onChange={(event) =>
                          changeRole(
                            user,
                            event.target.value === 'admin' ? 'admin' : 'user'
                          )
                        }
                      >
                        <option value="user">User</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={user.disabled ? 'destructive' : 'secondary'}
                        >
                          {user.disabled ? 'Disabled' : 'Active'}
                        </Badge>
                        {user.mustChangePassword && (
                          <Badge variant="outline">Temp password</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending !== null}
                          onClick={
                            user.id === currentUserId
                              ? () =>
                                  router.push(
                                    `${PASSWORD_CHANGE_PATH}?redirect=${encodeURIComponent(pathname)}`
                                  )
                              : () => resetPassword(user)
                          }
                        >
                          {user.id === currentUserId
                            ? 'Change password'
                            : 'Reset password'}
                        </Button>
                        <Button
                          variant={user.disabled ? 'default' : 'destructive'}
                          size="sm"
                          disabled={
                            pending !== null || user.id === currentUserId
                          }
                          onClick={() => toggleUser(user)}
                        >
                          {pending === user.id && (
                            <Loader2Icon className="animate-spin" />
                          )}
                          {user.disabled ? 'Enable' : 'Disable'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {reveal && (
        <TemporaryPasswordDialog
          reveal={reveal}
          onDismiss={() => setReveal(null)}
        />
      )}
    </div>
  )
}
