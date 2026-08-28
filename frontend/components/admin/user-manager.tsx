'use client'

import { Loader2Icon, UserPlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import {
  createUserAction,
  resetUserPasswordAction,
  setUserDisabledAction
} from '@/app/(dashboard)/admin/users/actions'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { LocalUser } from '@/providers/qlever/auth'

interface UserManagerProps {
  users: LocalUser[]
  currentUserId: string
}

export function UserManager({ users, currentUserId }: UserManagerProps) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setPending('create')
    const result = await createUserAction({
      username: String(data.get('username') ?? ''),
      password: String(data.get('password') ?? ''),
      role: data.get('role') === 'admin' ? 'admin' : 'user'
    })
    setPending(null)
    if (!result.ok) return toast.error(result.message)
    form.reset()
    toast.success(result.message)
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

  async function resetPassword(user: LocalUser) {
    const password = window.prompt(
      `Enter a new password for ${user.username}:`
    )
    if (password === null) return
    setPending(user.id)
    const result = await resetUserPasswordAction(user.id, password)
    setPending(null)
    if (!result.ok) return toast.error(result.message)
    toast.success(result.message)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create User</CardTitle>
          <CardDescription>
            Workbench accounts are stored locally and are independent from
            QLever UI accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={createUser}
            className="grid gap-4 md:grid-cols-[1fr_1fr_10rem_auto]"
          >
            <Input name="username" placeholder="Username" required />
            <Input
              name="password"
              type="password"
              minLength={12}
              placeholder="Password (12+ characters)"
              required
            />
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
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Disabling users or resetting passwords revokes their active
            sessions.
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
                    <TableCell className="capitalize">{user.role}</TableCell>
                    <TableCell>
                      <Badge
                        variant={user.disabled ? 'destructive' : 'secondary'}
                      >
                        {user.disabled ? 'Disabled' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending !== null}
                          onClick={() => resetPassword(user)}
                        >
                          Reset password
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
    </div>
  )
}
