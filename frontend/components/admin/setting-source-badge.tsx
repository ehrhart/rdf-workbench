'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import type { EnvResolution, SettingSource } from '@/lib/settings/resolve'

const SOURCE_BADGES: Record<
  SettingSource,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  overridden: { label: 'Modified', variant: 'default' },
  environment: { label: 'Deployment', variant: 'secondary' },
  default: { label: 'Default', variant: 'outline' }
}

interface SettingSourceBadgeProps {
  source: SettingSource
  envVar: string | null
  env: EnvResolution<unknown>
  currentValue: unknown
}

function tooltipText({
  source,
  envVar,
  env,
  currentValue
}: SettingSourceBadgeProps): string | null {
  if (source === 'environment') {
    return `Set by the environment variable ${envVar}.`
  }
  if (source === 'overridden') {
    if (env.state === 'valid') {
      return `Changed in this app. Resetting returns to ${envVar} (${formatValue(env.value, currentValue)}).`
    }
    if (env.state === 'invalid') {
      return `Changed in this app. ${envVar} is set to an invalid value, so resetting returns to the built-in default.`
    }
    return 'Changed in this app. Resetting returns to the built-in default.'
  }
  if (env.state === 'invalid') {
    return `${envVar} is set to an invalid value, so the built-in default applies. Fix the variable in the deployment to use it.`
  }
  return null
}

function formatValue(value: unknown, currentValue: unknown): string {
  if (typeof value === 'boolean' && typeof currentValue === 'boolean') {
    return value ? 'on' : 'off'
  }
  return String(value)
}

export function SettingSourceBadge(props: SettingSourceBadgeProps) {
  const badge = SOURCE_BADGES[props.source]
  const tooltip = tooltipText(props)
  if (!tooltip) {
    return <Badge variant={badge.variant}>{badge.label}</Badge>
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
