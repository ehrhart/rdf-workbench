'use server'

import { redirect } from 'next/navigation'
import { PASSWORD_CHANGE_PATH, safeInternalRedirect } from '@/config/access'
import { LoginFormSchema, type LoginFormState } from '@/lib/definitions'
import { AuthError, ConnectionError } from '@/lib/errors'
import { getWorkbenchRuntime } from '@/lib/runtime'
import type { Principal } from '@/lib/runtime/contracts'

export async function login(
  _state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  // 1. Validate form fields
  const validatedFields = LoginFormSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password')
  })

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors
    }
  }

  const { username, password } = validatedFields.data
  const requestedRedirect = formData.get('redirect') as string | null

  let principal: Principal
  try {
    principal = await (await getWorkbenchRuntime()).auth.login({
      username,
      password
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ConnectionError) {
      return { message: error.message }
    }
    console.error('Unexpected login error:', error)
    return {
      message: 'Unable to authenticate. Please try again.'
    }
  }

  // redirect() throws, so it stays outside the try/catch. A flagged
  // account lands on the change surface carrying the original target;
  // every other login redirects as before.
  redirect(
    principal.mustChangePassword
      ? `${PASSWORD_CHANGE_PATH}?redirect=${encodeURIComponent(
          safeInternalRedirect(requestedRedirect)
        )}`
      : safeInternalRedirect(requestedRedirect)
  )
}
