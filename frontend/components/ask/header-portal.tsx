'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export const SITE_HEADER_LEFT_ID = 'site-header-left'
export const SITE_HEADER_RIGHT_ID = 'site-header-right'

/**
 * Renders children into a site header slot. Portals keep the React
 * tree (and its context) intact, so chat controls rendered here still read
 * the ChatSessionProvider from inside the shell's header — the App Router
 * equivalent of passing buttons as props to a header the layout renders.
 */
export function HeaderPortal({
  children,
  side = 'left'
}: {
  children: ReactNode
  side?: 'left' | 'right'
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const target = document.getElementById(
    side === 'right' ? SITE_HEADER_RIGHT_ID : SITE_HEADER_LEFT_ID
  )
  if (!target) return null

  return createPortal(children, target)
}
