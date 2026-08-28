import type { Column, RowData } from '@tanstack/react-table'
import { FunnelIcon } from 'lucide-react'
import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { FilterContent } from './FilterContent'

interface ColumnFilterDropdownProps<TData extends RowData> {
  column: Column<TData, unknown>
}

export function ColumnFilterDropdown<TData extends RowData>({
  column
}: ColumnFilterDropdownProps<TData>) {
  const handleClose = useCallback(() => {
    // Close dropdown by dispatching escape key event
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Escape'
      })
    )
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="data-[state=open]:bg-accent h-7 w-7"
        >
          <FunnelIcon
            className={cn(
              'size-3.5',
              column.getIsFiltered() && 'text-blue-500'
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <FilterContent column={column} onClose={handleClose} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
