'use server'

import { revalidatePath } from 'next/cache'
import {
  createLocalUser,
  resetLocalUserPassword,
  setLocalUserDisabled
} from '@/lib/local-auth'
import { requireFeature } from '@/lib/runtime'

export interface UserActionResult {
  ok: boolean
  message: string
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed'
}

export async function createUserAction(input: {
  username: string
  password: string
  role: 'admin' | 'user'
}): Promise<UserActionResult> {
  try {
    await requireFeature('qlever-user-admin')
    await createLocalUser(input)
    revalidatePath('/admin/users')
    return { ok: true, message: `User ${input.username} created` }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}

export async function setUserDisabledAction(
  userId: string,
  disabled: boolean
): Promise<UserActionResult> {
  try {
    await requireFeature('qlever-user-admin')
    await setLocalUserDisabled(userId, disabled)
    revalidatePath('/admin/users')
    return { ok: true, message: disabled ? 'User disabled' : 'User enabled' }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}

export async function resetUserPasswordAction(
  userId: string,
  password: string
): Promise<UserActionResult> {
  try {
    await requireFeature('qlever-user-admin')
    await resetLocalUserPassword(userId, password)
    revalidatePath('/admin/users')
    return { ok: true, message: 'Password reset and active sessions revoked' }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}
