import 'server-only'

import { z } from 'zod'
import { isAiConfigured } from '@/lib/runtime/features'

const aiConfigSchema = z.object({
  AI_BASE_URL: z.string().url(),
  AI_API_KEY: z.string().min(1),
  AI_MODEL: z.string().min(1),
  AI_MAX_STEPS: z.coerce.number().int().min(2).max(20).default(20),
  AI_QUERY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(120_000)
    .default(30_000),
  AI_RESULT_LIMIT: z.coerce.number().int().min(1).max(10_000).default(1_000),
  AI_PROFILE_MAX_CLASSES: z.coerce.number().int().min(1).max(500).default(60),
  AI_PROFILE_MAX_PROPERTIES: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(30),
  AI_PROFILE_MAX_SAMPLES: z.coerce.number().int().min(1).max(10).default(3)
})

export type AiConfig = z.infer<typeof aiConfigSchema>

let cachedConfig: AiConfig | null | undefined

/**
 * Parsed on demand so deployments without AI settings keep working and
 * the Next.js build never embeds the key.
 */
export function getAiConfig(): AiConfig | null {
  if (cachedConfig !== undefined) return cachedConfig

  if (!isAiConfigured(process.env)) {
    cachedConfig = null
    return null
  }

  const parsed = aiConfigSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error(
      '[ask] AI environment variables are invalid, assistant disabled:',
      z.prettifyError(parsed.error)
    )
    cachedConfig = null
    return null
  }

  cachedConfig = parsed.data
  return parsed.data
}

export function isAiAskEnabled(): boolean {
  return getAiConfig() !== null
}
