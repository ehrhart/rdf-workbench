'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export interface PasswordReveal {
  username: string
  password: string
}

interface TemporaryPasswordDialogProps {
  reveal: PasswordReveal
  onDismiss: () => void
}

/**
 * Shows a generated temporary password exactly once. Dismissal by any
 * means — the Done button, Escape, the overlay, the close button — calls
 * `onDismiss`, which nulls the parent state; the server stores only the
 * argon2 hash, so the plaintext is unrecoverable after dismissal. There
 * is no reopen affordance.
 */
export function TemporaryPasswordDialog({
  reveal,
  onDismiss
}: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(reveal.password)
    setCopied(true)
    toast('Copied to clipboard')
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Temporary password for {reveal.username}</DialogTitle>
          <DialogDescription>
            Share this with the user. They sign in with it once, then set their
            own password.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            readOnly
            value={reveal.password}
            className="font-mono"
            onFocus={(event) => event.target.select()}
            aria-label="Temporary password"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copy}
            aria-label="Copy temporary password"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
        <p className="text-sm text-destructive">
          This is the only time it is shown.
        </p>
        <DialogFooter>
          <Button type="button" onClick={onDismiss}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
