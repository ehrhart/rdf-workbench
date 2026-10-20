'use server'

import { revalidatePath } from 'next/cache'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getSettingEntries } from '@/lib/settings/registry'
import { resetSettingValue, saveSettingValues } from '@/lib/settings/store'

export interface AccessFlagActionResult {
  ok: boolean
  message: string
}

function isAccessSettingKey(key: string): boolean {
  return getSettingEntries('access').some((entry) => entry.key === key)
}

export async function saveAccessFlag(
  key: string,
  value: boolean
): Promise<AccessFlagActionResult> {
  try {
    const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
    if (principal?.role !== 'admin' || principal.mustChangePassword) {
      throw new Error('Only administrators can change access settings')
    }
    if (!isAccessSettingKey(key)) {
      throw new Error(`Unknown access setting "${key}"`)
    }
    await saveSettingValues([{ key, value }], principal.username)
    revalidatePath('/admin/access')
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Access setting saved' }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'The operation failed'
    }
  }
}

export async function resetAccessFlag(
  key: string
): Promise<AccessFlagActionResult> {
  try {
    const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
    if (principal?.role !== 'admin' || principal.mustChangePassword) {
      throw new Error('Only administrators can change access settings')
    }
    if (!isAccessSettingKey(key)) {
      throw new Error(`Unknown access setting "${key}"`)
    }
    await resetSettingValue(key, principal.username)
    revalidatePath('/admin/access')
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Access setting reset' }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'The operation failed'
    }
  }
}
