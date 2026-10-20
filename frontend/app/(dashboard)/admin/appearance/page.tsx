import type { Metadata } from 'next'
import { AppearanceForm } from '@/components/admin/appearance-form'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import {
  getAppearanceAssetMeta,
  getAppearanceSettings
} from '@/lib/appearance/appearance-settings'
import { requirePageAccess } from '@/lib/runtime'
import { getWorkbenchName } from '@/lib/runtime/config'

export const metadata: Metadata = {
  title: 'Appearance',
  description: 'Set the name, logo, colors, and theme.'
}

export default async function AppearancePage() {
  await requirePageAccess('admin', '/admin/appearance')
  const settings = await getAppearanceSettings()
  const logoMeta = await getAppearanceAssetMeta('logo')

  return (
    <DashboardShell>
      <DashboardHeader heading="Appearance" />
      <AppearanceForm
        initial={settings}
        fallbackInstanceName={getWorkbenchName()}
        logoVersion={logoMeta?.updatedAt ?? null}
      />
    </DashboardShell>
  )
}
