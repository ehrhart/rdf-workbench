'use server'

import { revalidatePath } from 'next/cache'
import { validateDereferencePath } from '@/lib/dereference/rules'
import { getWorkbenchRuntime, requireFeature } from '@/lib/runtime'

export interface DereferenceActionResult {
  ok: boolean
  message: string
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed'
}

async function requireDereferenceAdmin(): Promise<void> {
  await requireFeature('dereference')
  await (await getWorkbenchRuntime()).auth.requireRole('admin')
}

export async function createDereferencePathAction(
  path: string
): Promise<DereferenceActionResult> {
  try {
    const runtime = await getWorkbenchRuntime()
    await requireDereferenceAdmin()
    const validated = validateDereferencePath(path, runtime.provider)
    await runtime.dereference.create(validated)
    revalidatePath('/admin/dereference')
    return { ok: true, message: `Path "/${validated}" configured` }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}

export async function renameDereferencePathAction(
  oldPath: string,
  newPath: string
): Promise<DereferenceActionResult> {
  try {
    const runtime = await getWorkbenchRuntime()
    await requireDereferenceAdmin()
    const validated = validateDereferencePath(newPath, runtime.provider)
    await runtime.dereference.rename(oldPath, validated)
    revalidatePath('/admin/dereference')
    return {
      ok: true,
      message: `Path "/${oldPath.trim()}" renamed to "/${validated}"`
    }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}

export async function removeDereferencePathAction(
  path: string
): Promise<DereferenceActionResult> {
  try {
    const runtime = await getWorkbenchRuntime()
    await requireDereferenceAdmin()
    await runtime.dereference.remove(path)
    revalidatePath('/admin/dereference')
    return { ok: true, message: `Path "/${path.trim()}" removed` }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}
