import type { Metadata } from 'next'
import { Open_Sans } from 'next/font/google'
import type React from 'react'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getWorkbenchName } from '@/lib/runtime/config'

import './globals.css'

const openSans = Open_Sans({ subsets: ['latin'] })

export function generateMetadata(): Metadata {
  const appName = getWorkbenchName()
  return {
    title: {
      default: appName,
      template: `%s | ${appName}`
    },
    description: 'A workbench for exploring RDF triplestores'
  }
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${openSans.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TooltipProvider delayDuration={250} disableHoverableContent>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
