'use server'

import { revalidatePath } from 'next/cache'
import { type AiSettings, saveAiSettings } from '@/lib/ai/ai-settings'
import { getWorkbenchRuntime, requireAnyFeature } from '@/lib/runtime'

export interface AiSettingsActionResult {
  ok: boolean
  message: string
}

export async function saveAiSettingsAction(
  input: AiSettings
): Promise<AiSettingsActionResult> {
  try {
    await requireAnyFeature(['ai-ask'])
    const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
    if (principal?.role !== 'admin') {
      throw new Error('Only administrators can change AI settings')
    }
    await saveAiSettings(input)
    revalidatePath('/admin/ai')
    return { ok: true, message: 'AI settings saved' }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'The operation failed'
    }
  }
}
