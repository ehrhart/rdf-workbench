'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export const SITE_HEADER_LEFT_ID = 'site-header-left'

/**
 * Renders children into the site header's left slot. Portals keep the React
 * tree (and its context) intact, so chat controls rendered here still read
 * the ChatSessionProvider from inside the shell's header — the App Router
 * equivalent of passing buttons as props to a header the layout renders.
 */
export function HeaderPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const target = document.getElementById(SITE_HEADER_LEFT_ID)
  if (!target) return null

  return createPortal(children, target)
}
