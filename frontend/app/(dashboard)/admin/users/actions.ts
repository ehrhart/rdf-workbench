'use server'

import { revalidatePath } from 'next/cache'
import {
  type CreateUserInput,
  type CreateUserReceipt,
  createLocalUser,
  resetLocalUserPassword,
  setLocalUserDisabled,
  setLocalUserRole
} from '@/lib/local-auth'
import { requireAnyFeature } from '@/lib/runtime'

export interface UserActionResult {
  ok: boolean
  message: string
}

export type CreateUserActionResult =
  | { ok: true; mode: 'manual'; message: string }
  | { ok: true; mode: 'temporary'; message: string; oneTimePassword: string }
  | { ok: false; message: string }

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed'
}

export async function createUserAction(
  input: CreateUserInput
): Promise<CreateUserActionResult> {
  try {
    await requireAnyFeature(['user-admin'])
    const receipt: CreateUserReceipt = await createLocalUser(input)
    revalidatePath('/admin/users')
    return receipt.mode === 'temporary'
      ? {
          ok: true,
          mode: 'temporary',
          message: `User ${input.username} created`,
          oneTimePassword: receipt.oneTimePassword
        }
      : {
          ok: true,
          mode: 'manual',
          message: `User ${input.username} created`
        }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}

export async function setUserDisabledAction(
  userId: string,
  disabled: boolean
): Promise<UserActionResult> {
  try {
    await requireAnyFeature(['user-admin'])
    await setLocalUserDisabled(userId, disabled)
    revalidatePath('/admin/users')
    return { ok: true, message: disabled ? 'User disabled' : 'User enabled' }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}

export async function setUserRoleAction(
  userId: string,
  role: 'admin' | 'user'
): Promise<UserActionResult> {
  try {
    await requireAnyFeature(['user-admin'])
    await setLocalUserRole(userId, role)
    revalidatePath('/admin/users')
    return {
      ok: true,
      message:
        role === 'admin'
          ? 'User promoted to administrator'
          : 'User changed to standard user'
    }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}

export type ResetUserPasswordActionResult =
  | { ok: true; message: string; oneTimePassword: string }
  | { ok: false; message: string }

export async function resetUserPasswordAction(
  userId: string
): Promise<ResetUserPasswordActionResult> {
  try {
    await requireAnyFeature(['user-admin'])
    const oneTimePassword = await resetLocalUserPassword(userId)
    revalidatePath('/admin/users')
    return {
      ok: true,
      message: 'Password reset and active sessions revoked',
      oneTimePassword
    }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}
