'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  resetAccessFlag,
  saveAccessFlag
} from '@/app/(dashboard)/admin/access/actions'
import { SettingSourceBadge } from '@/components/admin/setting-source-badge'
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
import { TooltipProvider } from '@/components/ui/tooltip'
import type { AccessFlagDetail } from '@/lib/access/access-flags'

const STATE_TEXT: Record<string, { on: string; off: string }> = {
  'access.allowAnonymousRead': {
    on: 'Visitors can browse without an account.',
    off: 'Visitors need an account to browse.'
  },
  'access.allowAnonymousAsk': {
    on: 'Visitors can chat without an account.',
    off: 'Visitors need an account to chat.'
  }
}

function stateText(detail: AccessFlagDetail): string {
  const state = STATE_TEXT[detail.key]
  return detail.currentValue ? state.on : state.off
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
        <CardTitle>Visitor access</CardTitle>
        <CardDescription>
          What visitors can do without signing in. Changes apply immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <TooltipProvider delayDuration={200}>
          {details.map((detail) => {
            return (
              <div
                key={detail.key}
                className="flex items-start justify-between gap-4 rounded-md border p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor={detail.key}>{detail.label}</Label>
                    <SettingSourceBadge
                      source={detail.source}
                      envVar={detail.envVar}
                      env={detail.env}
                      currentValue={detail.currentValue}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {stateText(detail)}
                  </p>
                  {detail.description && (
                    <p className="text-muted-foreground text-xs">
                      {detail.description}
                    </p>
                  )}
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
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
