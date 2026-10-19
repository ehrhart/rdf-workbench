'use client'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  restrictToParentElement,
  restrictToVerticalAxis
} from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from 'cn'
import { GripVerticalIcon, Loader2Icon, PlusIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { type UseFormRegister, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { saveAiSettingsAction } from '@/app/(dashboard)/admin/ai/actions'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { AiSettings } from '@/lib/ai/ai-settings'
import type { AiJobDto } from '@/lib/ai/ask-contract'
import { useAiJobs, useJobCompletion } from '@/lib/client/ai-jobs'

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

const MAX_QUESTIONS = 10
const MAX_QUESTION_LENGTH = 200
const MAX_KNOWLEDGE_LENGTH = 12000

const CARD_LABELS = {
  knowledge: 'Knowledge graph summary',
  instruction: 'Custom instruction',
  questions: 'Example questions'
} as const

type SaveTarget = keyof typeof CARD_LABELS

type QuestionsFormValues = { exampleQuestions: { value: string }[] }

interface AiSettingsFormProps {
  initial: AiSettings
  initialExploreJob: AiJobDto | null
}

function SortableQuestionRow({
  id,
  index,
  register,
  disabled,
  onRemove
}: {
  id: string
  index: number
  register: UseFormRegister<QuestionsFormValues>
  disabled: boolean
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2',
        isDragging && 'relative z-10 rounded-md bg-background shadow-md'
      )}
    >
      <Button
        ref={setActivatorNodeRef}
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Reorder question ${index + 1}`}
        className="cursor-grab touch-none text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon />
      </Button>
      <Input
        placeholder={`Example question ${index + 1}`}
        {...register(`exampleQuestions.${index}.value`)}
        maxLength={MAX_QUESTION_LENGTH}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove question ${index + 1}`}
        onClick={onRemove}
        disabled={disabled}
      >
        <XIcon />
      </Button>
    </div>
  )
}

export function AiSettingsForm({
  initial,
  initialExploreJob
}: AiSettingsFormProps) {
  const [savingCard, setSavingCard] = useState<SaveTarget | null>(null)
  const { job, running, elapsedSeconds, start, cancel } = useAiJobs(
    'explore',
    initialExploreJob
  )

  // Each card gets its own react-hook-form instance, so each card's Save
  // button tracks only its own changes. All three cards store their values
  // in one settings row, so every save writes the merged values of all
  // three forms.
  const knowledgeForm = useForm<{ graphKnowledge: string }>({
    defaultValues: { graphKnowledge: initial.graphKnowledge }
  })
  const instructionForm = useForm<{ customInstruction: string }>({
    defaultValues: { customInstruction: initial.customInstruction }
  })
  const questionsForm = useForm<QuestionsFormValues>({
    defaultValues: {
      exampleQuestions: initial.exampleQuestions.map((value) => ({ value }))
    }
  })

  useJobCompletion(job, (finished) => {
    if (finished.status === 'succeeded' && finished.knowledge) {
      // The runner already wrote the notes into ai_settings; mirroring them
      // into the form keeps the visible state in sync without a re-save.
      knowledgeForm.setValue('graphKnowledge', finished.knowledge, {
        shouldDirty: false
      })
      for (const form of [knowledgeForm, instructionForm, questionsForm]) {
        form.reset(form.getValues())
      }
      toast.success('Knowledge graph summary updated')
    } else if (finished.status === 'failed') {
      toast.error(finished.error ?? 'Summary generation failed')
    } else if (finished.status === 'cancelled') {
      toast.info('Summary generation cancelled')
    }
  })

  const { fields, append, remove, move } = useFieldArray({
    control: questionsForm.control,
    name: 'exampleQuestions'
  })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )
  const saving = savingCard !== null

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = fields.findIndex((field) => field.id === active.id)
    const to = fields.findIndex((field) => field.id === over.id)
    if (from < 0 || to < 0 || from === to) return
    move(from, to)
  }

  function addRow() {
    append({ value: '' })
  }

  async function saveCard(card: SaveTarget) {
    setSavingCard(card)
    const result = await saveAiSettingsAction({
      exampleQuestions: questionsForm
        .getValues('exampleQuestions')
        .map((row) => row.value.trim().slice(0, MAX_QUESTION_LENGTH))
        .filter((question) => question !== ''),
      customInstruction: instructionForm.getValues('customInstruction'),
      graphKnowledge: knowledgeForm.getValues('graphKnowledge')
    })
    setSavingCard(null)
    if (!result.ok) return toast.error(result.message)
    // The save stored every card's current values, so all three forms are
    // reset against them here and their Save buttons disable again.
    for (const form of [knowledgeForm, instructionForm, questionsForm]) {
      form.reset(form.getValues())
    }
    toast.success(`${CARD_LABELS[card]} saved`)
  }

  async function explore() {
    const result = await start()
    if (!result.ok) {
      toast.error(result.error ?? 'Summary generation failed')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Knowledge graph summary</CardTitle>
          <CardDescription>
            AI-generated notes about this dataset, injected into the Ask system
            prompt. Edit freely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={explore}
                disabled={saving || running}
              >
                {running && <Loader2Icon className="animate-spin" />}
                Generate summary
              </Button>
              {running && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => cancel()}
                  disabled={savingCard !== null}
                >
                  Cancel
                </Button>
              )}
            </div>
            {running ? (
              <p className="mt-2 text-muted-foreground text-sm">
                Running in the background ({formatElapsed(elapsedSeconds)}
                {job && job.stepsDone > 0 ? `, step ${job.stepsDone}` : ''}).
                You can leave this page; the notes are saved automatically.
              </p>
            ) : (
              <p className="mt-2 text-muted-foreground text-sm">
                Runs several read-only queries against the graph — this can take
                a few minutes.
              </p>
            )}
          </div>
          <Textarea
            rows={10}
            maxLength={MAX_KNOWLEDGE_LENGTH}
            placeholder="What the dataset describes, how entity types relate, useful query patterns, pitfalls…"
            disabled={running}
            aria-busy={running}
            {...knowledgeForm.register('graphKnowledge')}
          />
          <div className="flex justify-start">
            <Button
              type="button"
              onClick={() => saveCard('knowledge')}
              disabled={saving || running || !knowledgeForm.formState.isDirty}
            >
              {savingCard === 'knowledge' && (
                <Loader2Icon className="animate-spin" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom instruction</CardTitle>
          <CardDescription>
            Appended to the Ask assistant&apos;s system prompt on every request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={4}
            placeholder="Additional informations, behavior, style, and tone preferences"
            {...instructionForm.register('customInstruction')}
          />
          <div className="flex justify-start">
            <Button
              type="button"
              onClick={() => saveCard('instruction')}
              disabled={saving || !instructionForm.formState.isDirty}
            >
              {savingCard === 'instruction' && (
                <Loader2Icon className="animate-spin" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Example questions</CardTitle>
          <CardDescription>
            Shown on the Ask page when no conversation is open. Drag the handle
            to reorder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext
              items={fields.map((field) => field.id)}
              strategy={verticalListSortingStrategy}
            >
              {fields.map((field, index) => (
                <SortableQuestionRow
                  key={field.id}
                  id={field.id}
                  index={index}
                  register={questionsForm.register}
                  disabled={saving}
                  onRemove={() => remove(index)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <Button
            type="button"
            variant="outline"
            onClick={addRow}
            disabled={saving || fields.length >= MAX_QUESTIONS}
          >
            <PlusIcon />
            Add question
          </Button>
          <div className="flex justify-start">
            <Button
              type="button"
              onClick={() => saveCard('questions')}
              disabled={saving || !questionsForm.formState.isDirty}
            >
              {savingCard === 'questions' && (
                <Loader2Icon className="animate-spin" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
