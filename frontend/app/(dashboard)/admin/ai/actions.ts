'use server'

import { revalidatePath } from 'next/cache'
import { type AiSettings, saveAiSettings } from '@/lib/ai/ai-settings'
import { getWorkbenchRuntime, requireAnyFeature } from '@/lib/runtime'
import { getSettingEntries } from '@/lib/settings/registry'
import { resetSettingValue, saveSettingValues } from '@/lib/settings/store'

export interface AiSettingsActionResult {
  ok: boolean
  message: string
}

function isAiTuningKey(key: string): boolean {
  return getSettingEntries('ai').some((entry) => entry.key === key)
}

export async function saveAiTuning(
  key: string,
  value: number
): Promise<AiSettingsActionResult> {
  try {
    const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
    if (principal?.role !== 'admin' || principal.mustChangePassword) {
      throw new Error('Only administrators can change AI settings')
    }
    if (!isAiTuningKey(key)) {
      throw new Error(`Unknown AI setting "${key}"`)
    }
    await saveSettingValues([{ key, value }], principal.username)
    revalidatePath('/admin/ai')
    return { ok: true, message: 'AI settings saved' }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Couldn't update the setting."
    }
  }
}

export async function resetAiTuning(
  key: string
): Promise<AiSettingsActionResult> {
  try {
    const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
    if (principal?.role !== 'admin' || principal.mustChangePassword) {
      throw new Error('Only administrators can change AI settings')
    }
    if (!isAiTuningKey(key)) {
      throw new Error(`Unknown AI setting "${key}"`)
    }
    await resetSettingValue(key, principal.username)
    revalidatePath('/admin/ai')
    return { ok: true, message: 'AI settings reset' }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Couldn't reset the setting."
    }
  }
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
      message:
        error instanceof Error
          ? error.message
          : "Couldn't save the AI settings."
    }
  }
}
