'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { resetAiTuning, saveAiTuning } from '@/app/(dashboard)/admin/ai/actions'
import { SettingSourceBadge } from '@/components/admin/setting-source-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { EnvResolution, SettingSource } from '@/lib/settings/resolve'

export interface AiTuningDetail {
  key: string
  label: string
  description: string | null
  envVar: string | null
  currentValue: number
  source: SettingSource
  /** Stored UI override, or null when absent or invalid. */
  storedValue: number | null
  /** The environment variable's contribution, including when it is set but invalid. */
  env: EnvResolution<number>
}

function valuesFrom(details: AiTuningDetail[]): Record<string, string> {
  return Object.fromEntries(
    details.map((detail) => [detail.key, String(detail.currentValue)])
  )
}

export function AiTuningList({ details }: { details: AiTuningDetail[] }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(() =>
    valuesFrom(details)
  )
  const [pending, setPending] = useState<string | null>(null)
  /** Set on Reset mousedown so the blur it causes doesn't save first. */
  const skipBlurSave = useRef<string | null>(null)

  useEffect(() => {
    setValues(valuesFrom(details))
  }, [details])

  function isEdited(detail: AiTuningDetail): boolean {
    return Number(values[detail.key]) !== detail.currentValue
  }

  async function save(detail: AiTuningDetail) {
    setPending(detail.key)
    const result = await saveAiTuning(detail.key, Number(values[detail.key]))
    setPending(null)
    if (!result.ok) {
      setValues((previous) => ({
        ...previous,
        [detail.key]: String(detail.currentValue)
      }))
      toast.error(result.message)
      return
    }
    toast.success(result.message)
    router.refresh()
  }

  function saveIfEdited(detail: AiTuningDetail) {
    if (pending === null && isEdited(detail)) void save(detail)
  }

  async function reset(detail: AiTuningDetail) {
    setPending(detail.key)
    const result = await resetAiTuning(detail.key)
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
        <CardTitle>Tuning</CardTitle>
        <CardDescription>
          Bounds on the assistant&apos;s tool use, queries, and background jobs.
          Changes apply without a restart.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <TooltipProvider delayDuration={200}>
          {details.map((detail) => (
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
                    onMouseDown={() => {
                      skipBlurSave.current = detail.key
                    }}
                    onClick={() => reset(detail)}
                  >
                    Reset
                  </Button>
                )}
                <Input
                  id={detail.key}
                  type="number"
                  className="w-24"
                  value={values[detail.key] ?? ''}
                  disabled={pending !== null}
                  onChange={(event) =>
                    setValues((previous) => ({
                      ...previous,
                      [detail.key]: event.target.value
                    }))
                  }
                  onBlur={() => {
                    if (skipBlurSave.current === detail.key) {
                      skipBlurSave.current = null
                      return
                    }
                    saveIfEdited(detail)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                />
              </div>
            </div>
          ))}
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
