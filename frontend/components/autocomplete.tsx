import { Command as CommandPrimitive } from 'cmdk'
import { Fragment, useMemo, useState } from 'react'
import { Command, CommandGroup, CommandItem, CommandList } from './ui/command'
import { Input } from './ui/input'
import { Popover, PopoverAnchor, PopoverContent } from './ui/popover'

function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/(<b>|<\/b>)/g)
  let isBold = false

  const content = parts.map((part, i) => {
    if (part === '<b>') {
      isBold = true
      return null
    }
    if (part === '</b>') {
      isBold = false
      return null
    }
    return isBold ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts can repeat; position disambiguates
      <b key={`${i}-${part}`}>{part}</b>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts can repeat; position disambiguates
      <Fragment key={`${i}-${part}`}>{part}</Fragment>
    )
  })

  return <>{content}</>
}

type Props<T extends string> = {
  selectedValue: T
  onSelectedValueChange: (value: T | string) => void
  searchValue: string
  onSearchValueChange: (value: string) => void
  items: { id?: string; value: T; label: string; excerpt?: string }[]
  isLoading?: boolean
  emptyMessage?: string
  placeholder?: string
  resetOnBlur?: boolean
}

export function AutoComplete<T extends string>({
  selectedValue,
  onSelectedValueChange,
  searchValue,
  onSearchValueChange,
  items,
  isLoading,
  emptyMessage = 'No items.',
  placeholder = 'Search...',
  resetOnBlur = true
}: Props<T>) {
  const [open, setOpen] = useState(false)

  const labels = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc[item.value] = item.label
          return acc
        },
        {} as Record<string, string>
      ),
    [items]
  )

  const reset = () => {
    onSelectedValueChange('' as T)
    onSearchValueChange('')
  }

  const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (
      resetOnBlur &&
      !e.relatedTarget?.hasAttribute('cmdk-list') &&
      labels[selectedValue] !== searchValue
    ) {
      reset()
    }
  }

  const onSelectItem = (inputValue: string) => {
    if (inputValue === selectedValue) {
      reset()
    } else {
      onSelectedValueChange(inputValue as T)
      onSearchValueChange(labels[inputValue] ?? '')
    }
    setOpen(false)
  }

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false}>
          <PopoverAnchor asChild>
            <CommandPrimitive.Input
              asChild
              value={searchValue}
              onValueChange={onSearchValueChange}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false)
                  return
                }
                if (e.key === 'Enter') {
                  onSelectedValueChange(searchValue)
                }
              }}
              onMouseDown={() => setOpen((open) => !!searchValue || !open)}
              onFocus={() => setOpen(true)}
              onBlur={onInputBlur}
            >
              <Input placeholder={placeholder} />
            </CommandPrimitive.Input>
          </PopoverAnchor>
          {!open && <CommandList aria-hidden="true" className="hidden" />}
          <PopoverContent
            asChild
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (
                e.target instanceof Element &&
                e.target.hasAttribute('cmdk-input')
              ) {
                e.preventDefault()
              }
            }}
            className="w-(--radix-popover-trigger-width) p-0"
          >
            <CommandList>
              <CommandGroup heading="Suggestions">
                {isLoading ? (
                  <CommandItem
                    disabled
                    className="text-muted-foreground flex items-center gap-2 py-2"
                  >
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Loading suggestions...
                  </CommandItem>
                ) : items.length > 0 ? (
                  items.map((option, index) => (
                    <CommandItem
                      key={option.id || `${option.value}-${index}`}
                      value={option.id || `${option.value}-${index}`}
                      onSelect={() => onSelectItem(option.value)}
                      className="hover:bg-accent flex cursor-pointer flex-col items-start gap-1 py-2"
                    >
                      <div
                        className="truncate font-medium"
                        title={option.label}
                      >
                        {option.label}
                      </div>
                      {option.excerpt && (
                        <div className="text-muted-foreground line-clamp-2 text-xs">
                          <HighlightedText text={option.excerpt} />
                        </div>
                      )}
                    </CommandItem>
                  ))
                ) : (
                  <CommandItem
                    disabled
                    className="text-muted-foreground py-2 italic"
                  >
                    {emptyMessage}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </PopoverContent>
        </Command>
      </Popover>
    </div>
  )
}
