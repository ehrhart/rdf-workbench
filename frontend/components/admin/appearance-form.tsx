'use client'

import { cn } from 'cn'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  removeLogoAction,
  saveAppearanceSettingsAction,
  uploadLogoAction
} from '@/app/(dashboard)/admin/appearance/actions'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  type AppearanceSettings,
  DEFAULT_MODES,
  type DefaultMode,
  deriveTokens,
  RADIUS_CHOICES,
  type RadiusChoice,
  SIDEBAR_STYLES,
  type SidebarStyle
} from '@/lib/appearance/tokens'

const DEFAULT_SETTINGS: AppearanceSettings = {
  primaryColor: null,
  accentColor: null,
  sidebarColor: null,
  instanceName: '',
  radius: 'rounded',
  sidebarStyle: 'flush',
  defaultMode: 'light'
}

function ColorField({
  label,
  value,
  onChange
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
}) {
  const [text, setText] = useState(value ?? '')

  useEffect(() => {
    setText(value ?? '')
  }, [value])

  function commitFromText(input: string) {
    const digits = input.trim().replace(/^#/, '')
    if (/^[0-9a-f]{6}$/i.test(digits)) {
      onChange(`#${digits.toLowerCase()}`)
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          aria-label={label}
          className="size-9 cursor-pointer p-1"
          value={value ?? '#000000'}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          aria-label={`${label} hex`}
          className="w-28 font-mono text-xs"
          placeholder="not customized"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            commitFromText(event.target.value)
          }}
          onBlur={() => setText(value ?? '')}
        />
        {value !== null && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onChange(null)}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}

function PreviewPanel({
  mode,
  variables,
  sidebarStyle
}: {
  mode: 'light' | 'dark'
  variables: Record<string, string>
  sidebarStyle: SidebarStyle
}) {
  return (
    <div
      className={cn(
        'flex overflow-hidden rounded-[8px] border text-foreground',
        mode === 'dark' && 'dark',
        sidebarStyle === 'inset' && 'bg-sidebar'
      )}
      style={{ ...variables } as React.CSSProperties}
    >
      <div
        className={cn(
          'flex w-20 shrink-0 flex-col gap-1 bg-sidebar p-1.5 text-sidebar-foreground text-xs',
          sidebarStyle === 'flush' && 'rounded-r-lg',
          sidebarStyle === 'floating' &&
            'm-2 rounded-lg shadow-sm ring-1 ring-sidebar-border'
        )}
      >
        <div className="rounded-md bg-sidebar-accent px-1.5 py-1 text-sidebar-accent-foreground">
          Active
        </div>
        <div className="px-1.5 py-1 opacity-80">Item</div>
      </div>
      <div
        className={cn(
          'min-w-0 flex-1 space-y-2 p-3',
          sidebarStyle === 'inset' && 'm-2 ml-0 rounded-xl bg-background'
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Primary</Button>
          <Button size="sm" variant="outline">
            Outline
          </Button>
          <Badge>Badge</Badge>
        </div>
        <div className="rounded-lg border bg-card p-2 text-muted-foreground text-xs">
          Muted card text
        </div>
        <div className="rounded-lg border p-1 text-xs">
          <div className="px-2 py-1">Menu item</div>
          <div className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
            Highlighted item
          </div>
          <div className="px-2 py-1">Menu item</div>
        </div>
      </div>
    </div>
  )
}

export function AppearanceForm({
  initial,
  logoVersion
}: {
  initial: AppearanceSettings
  logoVersion: string | null
}) {
  const [draft, setDraft] = useState<AppearanceSettings>(initial)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [currentLogoVersion, setCurrentLogoVersion] = useState(logoVersion)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const derived = deriveTokens(draft)
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const isDefault = JSON.stringify(draft) === JSON.stringify(DEFAULT_SETTINGS)

  async function save(next: AppearanceSettings) {
    setSaving(true)
    const result = await saveAppearanceSettingsAction(next)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    setDraft(next)
    toast.success(result.message)
  }

  async function onLogoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 350_000) {
      toast.error('Logo must be under 256 KB')
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    }).catch(() => null)
    if (dataUrl === null) {
      toast.error('Could not read the logo file')
      return
    }
    setUploading(true)
    const result = await uploadLogoAction(dataUrl)
    setUploading(false)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    setCurrentLogoVersion(result.version ?? null)
    toast.success(result.message)
  }

  async function removeLogo() {
    setUploading(true)
    const result = await removeLogoAction()
    setUploading(false)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    setCurrentLogoVersion(null)
    toast.success(result.message)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>
            The logo shows in the sidebar, on the login page, and as the browser
            tab icon. PNG, JPEG, WEBP, or SVG up to 256 KB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="instance-name">Instance name</Label>
            <Input
              id="instance-name"
              maxLength={60}
              value={draft.instanceName ?? ''}
              onChange={(event) =>
                setDraft({ ...draft, instanceName: event.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-2">
              {currentLogoVersion !== null && (
                // biome-ignore lint/performance/noImgElement: live preview of the uploaded logo served by a dynamic route; image optimization is disabled app-wide
                <img
                  src={`/api/appearance/logo?v=${currentLogoVersion}`}
                  alt="Current logo"
                  className="size-8"
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={onLogoFileChange}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload logo
              </Button>
              {currentLogoVersion !== null && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={removeLogo}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Changes here apply to the whole app after saving. The accent shows
            up on hovers, menus, and selected rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField
              label="Primary color"
              value={draft.primaryColor}
              onChange={(value) => setDraft({ ...draft, primaryColor: value })}
            />
            <ColorField
              label="Accent color"
              value={draft.accentColor}
              onChange={(value) => setDraft({ ...draft, accentColor: value })}
            />
            <ColorField
              label="Sidebar color"
              value={draft.sidebarColor}
              onChange={(value) => setDraft({ ...draft, sidebarColor: value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Corner radius</Label>
              <Select
                value={draft.radius}
                onValueChange={(value) =>
                  setDraft({ ...draft, radius: value as RadiusChoice })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RADIUS_CHOICES.map((choice) => (
                    <SelectItem key={choice.id} value={choice.id}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sidebar style</Label>
              <Select
                value={draft.sidebarStyle}
                onValueChange={(value) =>
                  setDraft({ ...draft, sidebarStyle: value as SidebarStyle })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIDEBAR_STYLES.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default theme mode</Label>
              <Select
                value={draft.defaultMode}
                onValueChange={(value) =>
                  setDraft({ ...draft, defaultMode: value as DefaultMode })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_MODES.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Light</p>
                <PreviewPanel
                  mode="light"
                  variables={derived.light}
                  sidebarStyle={draft.sidebarStyle}
                />
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Dark</p>
                <PreviewPanel
                  mode="dark"
                  variables={derived.dark}
                  sidebarStyle={draft.sidebarStyle}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => save(draft)}
              disabled={!isDirty || saving}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => save(DEFAULT_SETTINGS)}
              disabled={isDefault || saving}
            >
              Reset to defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
