'use client'

import { createContext, useContext } from 'react'

const PrefixesContext = createContext<Record<string, string>>({})

export function PrefixesProvider({
  prefixes,
  children
}: {
  prefixes: Record<string, string>
  children: React.ReactNode
}) {
  return (
    <PrefixesContext.Provider value={prefixes}>
      {children}
    </PrefixesContext.Provider>
  )
}

export function usePrefixes(): Record<string, string> {
  return useContext(PrefixesContext)
}
