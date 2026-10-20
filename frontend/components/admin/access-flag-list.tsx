'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  resetAccessFlag,
  saveAccessFlag
} from '@/app/(dashboard)/admin/access/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AccessFlagDetail } from '@/lib/access/access-flags'

const SOURCE_BADGES: Record<
  AccessFlagDetail['source'],
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  overridden: { label: 'Overridden', variant: 'default' },
  environment: { label: 'Environment', variant: 'secondary' },
  default: { label: 'Default', variant: 'outline' }
}

function sourceText(detail: AccessFlagDetail): string {
  if (detail.source === 'overridden') {
    return detail.envValue === null
      ? 'Overridden here, env unset'
      : `Overridden here, env says ${detail.envValue ? 'on' : 'off'}`
  }
  if (detail.source === 'environment') {
    return `Following ${detail.envVar ?? 'the environment'} (currently ${detail.envValue ? 'on' : 'off'})`
  }
  return `Following the default (${detail.currentValue ? 'on' : 'off'})`
}

function valuesFrom(details: AccessFlagDetail[]): Record<string, boolean> {
  return Object.fromEntries(
    details.map((detail) => [detail.key, detail.currentValue])
  )
}

export function AccessFlagList({ details }: { details: AccessFlagDetail[] }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, boolean>>(() =>
    valuesFrom(details)
  )
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    setValues(valuesFrom(details))
  }, [details])

  async function toggle(detail: AccessFlagDetail, value: boolean) {
    setValues((previous) => ({ ...previous, [detail.key]: value }))
    setPending(detail.key)
    const result = await saveAccessFlag(detail.key, value)
    setPending(null)
    if (!result.ok) {
      setValues((previous) => ({
        ...previous,
        [detail.key]: detail.currentValue
      }))
      toast.error(result.message)
      return
    }
    toast.success(result.message)
    router.refresh()
  }

  async function reset(detail: AccessFlagDetail) {
    const confirmed = window.confirm(
      `Reset ${detail.label}? The environment value or the default applies again.`
    )
    if (!confirmed) return
    setPending(detail.key)
    const result = await resetAccessFlag(detail.key)
    setPending(null)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success(result.message)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anonymous access</CardTitle>
        <CardDescription>
          Changes apply to logged-out visitors immediately. A value saved here
          overrides the environment until it is reset, and every change is
          recorded in the settings history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {details.map((detail) => {
          const badge = SOURCE_BADGES[detail.source]
          return (
            <div
              key={detail.key}
              className="flex items-start justify-between gap-4 rounded-md border p-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor={detail.key}>{detail.label}</Label>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {sourceText(detail)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {detail.storedValue !== null && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending !== null}
                    onClick={() => reset(detail)}
                  >
                    Reset
                  </Button>
                )}
                <Switch
                  id={detail.key}
                  checked={values[detail.key] ?? detail.currentValue}
                  onCheckedChange={(checked) => toggle(detail, checked)}
                  disabled={pending !== null}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
