'use server'

import { redirect } from 'next/navigation'
import { LoginFormSchema, type LoginFormState } from '@/lib/definitions'
import { AuthError, ConnectionError } from '@/lib/errors'
import { getWorkbenchRuntime } from '@/lib/runtime'

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
  const redirectUrl =
    requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
      ? requestedRedirect
      : '/'

  try {
    await (await getWorkbenchRuntime()).auth.login({ username, password })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ConnectionError) {
      return { message: error.message }
    }
    console.error('Unexpected login error:', error)
    return {
      message: 'Unable to authenticate. Please try again.'
    }
  }

  redirect(redirectUrl)
}
