'use server'

import { revalidatePath } from 'next/cache'
import {
  type AppearanceSettings,
  removeAppearanceAsset,
  saveAppearanceAsset,
  saveAppearanceSettings
} from '@/lib/appearance/appearance-settings'
import { getWorkbenchRuntime } from '@/lib/runtime'

export interface AppearanceSettingsActionResult {
  ok: boolean
  message: string
}

export interface LogoActionResult {
  ok: boolean
  message: string
  version?: string
}

export async function saveAppearanceSettingsAction(
  input: AppearanceSettings
): Promise<AppearanceSettingsActionResult> {
  try {
    const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
    if (principal?.role !== 'admin') {
      throw new Error('Only administrators can change appearance settings')
    }
    await saveAppearanceSettings(input)
    revalidatePath('/admin/appearance')
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Appearance saved' }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Couldn't save the appearance."
    }
  }
}

export async function uploadLogoAction(
  dataUrl: string
): Promise<LogoActionResult> {
  try {
    const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
    if (principal?.role !== 'admin') {
      throw new Error('Only administrators can change appearance settings')
    }
    const { updatedAt } = await saveAppearanceAsset('logo', dataUrl)
    revalidatePath('/admin/appearance')
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Logo updated', version: updatedAt }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Couldn't upload the logo."
    }
  }
}

export async function removeLogoAction(): Promise<LogoActionResult> {
  try {
    const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
    if (principal?.role !== 'admin') {
      throw new Error('Only administrators can change appearance settings')
    }
    await removeAppearanceAsset('logo')
    revalidatePath('/admin/appearance')
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Logo removed' }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Couldn't remove the logo."
    }
  }
}
