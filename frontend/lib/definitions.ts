import * as z from 'zod'

/** One home for the password length policy, shared by local-auth
 *  (create/reset/change) and the form schemas below. Lives in this
 *  client-safe module so client components can read it too. */
export const PASSWORD_MIN_LENGTH = 8

export const LoginFormSchema = z.object({
  username: z.string().min(1, { message: 'Username is required' }).trim(),
  password: z.string().min(1, { message: 'Password is required' })
})

export type LoginFormState =
  | {
      errors?: {
        username?: string[]
        password?: string[]
      }
      message?: string
    }
  | undefined

export const ChangePasswordFormSchema = z
  .object({
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, {
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    }),
    confirmPassword: z.string().min(PASSWORD_MIN_LENGTH, {
      message: 'Please confirm the new password'
    })
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

export type ChangePasswordFormState =
  | {
      errors?: {
        newPassword?: string[]
        confirmPassword?: string[]
      }
      message?: string
    }
  | undefined
