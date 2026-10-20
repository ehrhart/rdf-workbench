import 'server-only'

import { z } from 'zod'
import { isAiConfigured } from '@/lib/runtime/features'
import {
  AI_TUNING_ENTRIES,
  aiJobTimeoutMsEntry,
  aiMaxStepsEntry,
  aiProfileMaxClassesEntry,
  aiProfileMaxPropertiesEntry,
  aiProfileMaxSamplesEntry,
  aiQueryTimeoutMsEntry,
  aiResultLimitEntry
} from '@/lib/settings/registry'
import { getStoredResolutions } from '@/lib/settings/store'

/**
 * The three deployment variables that identify the assistant. They stay
 * env-only: credentials and endpoints are structurally impossible to
 * store. A parse failure here still disables the assistant as a whole,
 * because without a working endpoint and model there is nothing to tune.
 */
const aiProviderSchema = z.object({
  AI_BASE_URL: z.string().url(),
  AI_API_KEY: z.string().min(1),
  AI_MODEL: z.string().min(1)
})

export interface AiConfig {
  AI_BASE_URL: string
  AI_API_KEY: string
  AI_MODEL: string
  AI_MAX_STEPS: number
  AI_QUERY_TIMEOUT_MS: number
  AI_RESULT_LIMIT: number
  AI_JOB_TIMEOUT_MS: number
  AI_PROFILE_MAX_CLASSES: number
  AI_PROFILE_MAX_PROPERTIES: number
  AI_PROFILE_MAX_SAMPLES: number
}

let providerInvalidLogged = false

/**
 * Parsed on demand so deployments without AI settings keep working and
 * the Next.js build never embeds the key. Tuning knobs resolve through
 * the settings store on every call, so a saved override applies without
 * a restart. One invalid tuning variable degrades only its own knob to
 * the registry default; the other knobs still apply.
 */
export async function getAiConfig(): Promise<AiConfig | null> {
  if (!isAiConfigured(process.env)) return null

  const provider = aiProviderSchema.safeParse(process.env)
  if (!provider.success) {
    if (!providerInvalidLogged) {
      providerInvalidLogged = true
      console.error(
        '[ask] AI provider environment variables are invalid, assistant disabled:',
        z.prettifyError(provider.error)
      )
    }
    return null
  }

  const resolutions = await getStoredResolutions(AI_TUNING_ENTRIES)
  return {
    AI_BASE_URL: provider.data.AI_BASE_URL,
    AI_API_KEY: provider.data.AI_API_KEY,
    AI_MODEL: provider.data.AI_MODEL,
    AI_MAX_STEPS: resolutions[aiMaxStepsEntry.key].resolution.value,
    AI_QUERY_TIMEOUT_MS:
      resolutions[aiQueryTimeoutMsEntry.key].resolution.value,
    AI_RESULT_LIMIT: resolutions[aiResultLimitEntry.key].resolution.value,
    AI_JOB_TIMEOUT_MS: resolutions[aiJobTimeoutMsEntry.key].resolution.value,
    AI_PROFILE_MAX_CLASSES:
      resolutions[aiProfileMaxClassesEntry.key].resolution.value,
    AI_PROFILE_MAX_PROPERTIES:
      resolutions[aiProfileMaxPropertiesEntry.key].resolution.value,
    AI_PROFILE_MAX_SAMPLES:
      resolutions[aiProfileMaxSamplesEntry.key].resolution.value
  }
}
