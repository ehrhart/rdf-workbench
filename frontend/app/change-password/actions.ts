'use server'

import { redirect } from 'next/navigation'
import { safeInternalRedirect } from '@/config/access'
import {
  ChangePasswordFormSchema,
  type ChangePasswordFormState
} from '@/lib/definitions'
import { AuthError, QueryError } from '@/lib/errors'
import { changeOwnLocalPassword } from '@/lib/local-auth'

export async function changePasswordAction(
  _state: ChangePasswordFormState,
  formData: FormData
): Promise<ChangePasswordFormState> {
  const parsed = ChangePasswordFormSchema.safeParse({
    currentPassword: formData.get('currentPassword') || undefined,
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword')
  })
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  try {
    await changeOwnLocalPassword(
      parsed.data.newPassword,
      parsed.data.currentPassword
    )
  } catch (error) {
    if (error instanceof AuthError || error instanceof QueryError) {
      return { message: error.message }
    }
    console.error('Unexpected password change error:', error)
    return { message: "Couldn't change your password. Try again in a moment." }
  }

  // redirect() throws, so it stays outside the try/catch. Lands on the
  // page the user was originally heading to, or '/'.
  redirect(safeInternalRedirect(formData.get('redirect') as string | null))
}
