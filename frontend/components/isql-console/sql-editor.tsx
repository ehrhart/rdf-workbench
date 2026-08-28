'use client'

import { Textarea } from '@/components/ui/textarea'

interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SqlEditor({ value, onChange, placeholder }: SqlEditorProps) {
  return (
    <Textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="max-h-[320px] font-mono text-sm rounded-none rounded-b-xl border-none field-sizing-content"
      placeholder={placeholder ?? 'Enter an ISQL command'}
      spellCheck={false}
    />
  )
}
