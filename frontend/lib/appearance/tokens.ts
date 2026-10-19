export type RadiusChoice = 'default' | 'sharp' | 'medium' | 'large'
export type DefaultMode = 'light' | 'dark' | 'system'

export interface AppearanceSettings {
  primaryColor: string | null
  accentColor: string | null
  sidebarColor: string | null
  instanceName: string | null
  radius: RadiusChoice
  defaultMode: DefaultMode
}

export interface DerivedTokens {
  light: Record<string, string>
  dark: Record<string, string>
}

interface Oklch {
  L: number
  C: number
  h: number
}

export const RADIUS_CHOICES: readonly {
  id: RadiusChoice
  label: string
  value: string | null
}[] = [
  { id: 'default', label: 'Default', value: null },
  { id: 'sharp', label: 'Sharp', value: '0.125rem' },
  { id: 'medium', label: 'Medium', value: '0.625rem' },
  { id: 'large', label: 'Large', value: '1.25rem' }
]

export const DEFAULT_MODES: readonly { id: DefaultMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' }
]

function srgbToLinearChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** sRGB (#rrggbb) → OKLab → polar OKLCH, per Ottosson's reference matrices. */
function hexToOklch(hex: string): Oklch {
  const r = srgbToLinearChannel(Number.parseInt(hex.slice(1, 3), 16) / 255)
  const g = srgbToLinearChannel(Number.parseInt(hex.slice(3, 5), 16) / 255)
  const b = srgbToLinearChannel(Number.parseInt(hex.slice(5, 7), 16) / 255)
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const lPrime = Math.cbrt(l)
  const mPrime = Math.cbrt(m)
  const sPrime = Math.cbrt(s)
  const L = 0.2104542553 * lPrime + 0.793617785 * mPrime - 0.0040720468 * sPrime
  const a = 1.9779984951 * lPrime - 2.428592205 * mPrime + 0.4505937099 * sPrime
  const bAxis =
    0.0259040371 * lPrime + 0.7827717662 * mPrime - 0.808675766 * sPrime
  return {
    L,
    C: Math.hypot(a, bAxis),
    h: ((Math.atan2(bAxis, a) * 180) / Math.PI + 360) % 360
  }
}

function oklchToLinearSrgb(color: Oklch): [number, number, number] {
  const a = color.C * Math.cos((color.h * Math.PI) / 180)
  const b = color.C * Math.sin((color.h * Math.PI) / 180)
  const lPrime = color.L + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = color.L - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = color.L - 0.0894841775 * a - 1.291485548 * b
  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ]
}

const GAMUT_TOLERANCE = 0.001

function isInGamut(color: Oklch): boolean {
  return oklchToLinearSrgb(color).every(
    (channel) => channel >= -GAMUT_TOLERANCE && channel <= 1 + GAMUT_TOLERANCE
  )
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

function clampChroma(color: Oklch): Oklch {
  if (isInGamut(color)) return color
  let low = 0
  let high = color.C
  for (let step = 0; step < 20; step += 1) {
    const mid = (low + high) / 2
    if (isInGamut({ ...color, C: mid })) {
      low = mid
    } else {
      high = mid
    }
  }
  return { ...color, C: low }
}

function relativeLuminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearSrgb(color).map(clamp01)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: number, b: number): number {
  const [lighter, darker] = a >= b ? [a, b] : [b, a]
  return (lighter + 0.05) / (darker + 0.05)
}

const LIGHT_FOREGROUND: Oklch = { L: 0.985, C: 0, h: 0 }
const DARK_FOREGROUND: Oklch = { L: 0.205, C: 0, h: 0 }

function pickForeground(primary: Oklch): Oklch {
  const background = relativeLuminance(primary)
  const lightRatio = contrastRatio(
    relativeLuminance(LIGHT_FOREGROUND),
    background
  )
  const darkRatio = contrastRatio(
    relativeLuminance(DARK_FOREGROUND),
    background
  )
  return lightRatio >= darkRatio ? LIGHT_FOREGROUND : DARK_FOREGROUND
}

const AA_MUTED_CONTRAST_TARGET = 4.6

function pickMutedForeground(bg: Oklch, foreground: Oklch): Oklch {
  const target = AA_MUTED_CONTRAST_TARGET
  const bgLuminance = relativeLuminance(bg)
  if (contrastRatio(relativeLuminance(foreground), bgLuminance) < target) {
    return foreground
  }
  let low = 0
  let high = 1
  for (let step = 0; step < 20; step += 1) {
    const mid = (low + high) / 2
    const mixed = {
      L: bg.L + mid * (foreground.L - bg.L),
      C: bg.C * (1 - mid),
      h: bg.h
    }
    if (
      contrastRatio(relativeLuminance(clampChroma(mixed)), bgLuminance) >=
      target
    ) {
      high = mid
    } else {
      low = mid
    }
  }
  return clampChroma({
    L: bg.L + high * (foreground.L - bg.L),
    C: bg.C * (1 - high),
    h: bg.h
  })
}

function formatNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

function toOklchString(color: Oklch): string {
  return `oklch(${formatNumber(color.L)} ${formatNumber(color.C)} ${formatNumber(color.h)})`
}

/** Only variables that differ from the built-in theme; empty records when nothing is set. */
export function deriveTokens(settings: AppearanceSettings): DerivedTokens {
  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}

  if (settings.primaryColor) {
    const seed = hexToOklch(settings.primaryColor)
    const lightL = Math.min(Math.max(seed.L, 0.35), 0.72)
    const lightPrimary = clampChroma({ L: lightL, C: seed.C, h: seed.h })
    const lightForeground = pickForeground(lightPrimary)
    const primary = toOklchString(lightPrimary)
    const primaryForeground = toOklchString(lightForeground)
    light['--primary'] = primary
    light['--primary-foreground'] = primaryForeground
    light['--ring'] = primary
    light['--sidebar-primary'] = primary
    light['--sidebar-primary-foreground'] = primaryForeground

    const darkL = Math.min(Math.max(0.55 + (1 - lightL) * 0.4, 0.75), 0.92)
    const darkPrimary = clampChroma({ L: darkL, C: seed.C * 0.85, h: seed.h })
    const darkForeground = pickForeground(darkPrimary)
    const darkPrimaryValue = toOklchString(darkPrimary)
    const darkForegroundValue = toOklchString(darkForeground)
    dark['--primary'] = darkPrimaryValue
    dark['--primary-foreground'] = darkForegroundValue
    dark['--ring'] = darkPrimaryValue
    dark['--sidebar-primary'] = darkPrimaryValue
    dark['--sidebar-primary-foreground'] = darkForegroundValue
  }

  if (settings.accentColor) {
    const seed = hexToOklch(settings.accentColor)
    const lightAccent = clampChroma({
      L: 0.955,
      C: Math.min(seed.C, 0.08),
      h: seed.h
    })
    const lightAccentForeground = clampChroma({
      L: 0.32,
      C: Math.min(seed.C * 0.75, 0.15),
      h: seed.h
    })
    light['--accent'] = toOklchString(lightAccent)
    light['--accent-foreground'] = toOklchString(lightAccentForeground)

    const darkAccent = clampChroma({
      L: 0.27,
      C: Math.min(seed.C * 0.4, 0.1),
      h: seed.h
    })
    const darkAccentForeground = clampChroma({
      L: 0.93,
      C: Math.min(seed.C * 0.5, 0.12),
      h: seed.h
    })
    dark['--accent'] = toOklchString(darkAccent)
    dark['--accent-foreground'] = toOklchString(darkAccentForeground)
  }

  if (settings.sidebarColor) {
    const seed = hexToOklch(settings.sidebarColor)
    const bg = clampChroma(seed)
    const bgValue = toOklchString(bg)
    const towardForeground = bg.L >= 0.5 ? -1 : 1
    const accent = clampChroma({
      L: clamp01(bg.L + towardForeground * 0.06),
      C: bg.C,
      h: bg.h
    })
    const border = clampChroma({
      L: clamp01(bg.L + towardForeground * 0.12),
      C: bg.C,
      h: bg.h
    })
    const foreground = pickForeground(bg)
    const accentForeground = pickForeground(accent)
    const mutedForeground = pickMutedForeground(bg, foreground)
    for (const vars of [light, dark]) {
      vars['--sidebar'] = bgValue
      vars['--sidebar-foreground'] = toOklchString(foreground)
      vars['--sidebar-muted-foreground'] = toOklchString(mutedForeground)
      vars['--sidebar-accent'] = toOklchString(accent)
      vars['--sidebar-accent-foreground'] = toOklchString(accentForeground)
      vars['--sidebar-border'] = toOklchString(border)
    }
  }

  const radius = RADIUS_CHOICES.find(
    (choice) => choice.id === settings.radius
  )?.value
  if (radius) {
    light['--radius'] = radius
    dark['--radius'] = radius
  }

  return { light, dark }
}

function cssBlock(selector: string, variables: Record<string, string>): string {
  const declarations = Object.entries(variables)
    .map(([name, value]) => `${name}:${value}`)
    .join(';')
  return `${selector}{${declarations}}`
}

export function buildAppearanceCss(
  settings: AppearanceSettings
): string | null {
  const { light, dark } = deriveTokens(settings)
  const blocks: string[] = []
  if (Object.keys(light).length > 0) {
    blocks.push(cssBlock(':root', light))
  }
  if (Object.keys(dark).length > 0) {
    blocks.push(cssBlock('.dark', dark))
  }
  return blocks.length > 0 ? blocks.join('\n') : null
}
