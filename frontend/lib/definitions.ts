import * as z from 'zod'

export const LoginFormSchema = z.object({
  username: z.string().min(1, { message: 'Username is required' }).trim(),
  password: z.string().min(1, { message: 'Password is required' })
})

export interface SessionPayload {
  userId: string
  username: string
  token: string
  expiresAt: Date
}

export type LoginFormState =
  | {
      errors?: {
        username?: string[]
        password?: string[]
      }
      message?: string
    }
  | undefined
