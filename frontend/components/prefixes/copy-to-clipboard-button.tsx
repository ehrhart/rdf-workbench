'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'
import { type ComponentProps, type JSX, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

interface CopyToClipboardButtonProps
  extends Omit<ComponentProps<typeof Button>, 'onClick' | 'children'> {
  textToCopy: string | (() => string)
  tooltipText?: string
  copiedTooltipText?: string
  successMessage?: string
  errorMessage?: string
  copyIcon?: JSX.Element
  copiedIcon?: JSX.Element
}

export function CopyToClipboardButton({
  textToCopy,
  tooltipText,
  copiedTooltipText = 'Copied!',
  successMessage = 'Copied to clipboard',
  errorMessage = 'Failed to copy',
  copyIcon: CopyIconComponent = <CopyIcon />,
  copiedIcon: CopiedIconComponent = <CheckIcon />,
  variant = 'ghost',
  size = 'icon',
  className,
  ...props
}: CopyToClipboardButtonProps): JSX.Element {
  const [isCopied, setIsCopied] = useState<boolean>(false)

  const handleCopy = async (
    event: React.MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    event.stopPropagation()
    event.preventDefault()
    try {
      const text = typeof textToCopy === 'function' ? textToCopy() : textToCopy
      await navigator.clipboard.writeText(text)
      toast.success(successMessage)
      setIsCopied(true)
    } catch (err) {
      toast.error(errorMessage, {
        description: err instanceof Error ? err.message : String(err)
      })
      console.error(`${errorMessage}: `, err)
    }
  }

  useEffect(() => {
    if (isCopied) {
      const timer: NodeJS.Timeout = setTimeout(() => {
        setIsCopied(false)
      }, 2000) // Revert icon after 2 seconds
      return () => clearTimeout(timer)
    }
  }, [isCopied])

  const buttonElement: JSX.Element = (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleCopy}
      {...props}
    >
      {isCopied ? CopiedIconComponent : CopyIconComponent}
      <span className="sr-only">
        {isCopied ? copiedTooltipText : tooltipText}
      </span>
    </Button>
  )

  if (tooltipText) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{buttonElement}</TooltipTrigger>
        <TooltipContent>
          <p>{isCopied ? copiedTooltipText : tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return buttonElement
}
