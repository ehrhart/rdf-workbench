import 'server-only'

import { getWorkbenchDatabase } from '@/lib/workbench-database'

const MAX_EXAMPLE_QUESTIONS = 10
const MAX_QUESTION_LENGTH = 200
const MAX_INSTRUCTION_LENGTH = 2000
const MAX_KNOWLEDGE_LENGTH = 12_000

export interface AiSettings {
  exampleQuestions: string[]
  customInstruction: string
  graphKnowledge: string
}

interface AiSettingsRow {
  example_questions: string
  custom_instruction: string
  graph_knowledge: string
}

const EMPTY_SETTINGS: AiSettings = {
  exampleQuestions: [],
  customInstruction: '',
  graphKnowledge: ''
}

function parseExampleQuestions(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (value): value is string =>
        typeof value === 'string' && value.trim() !== ''
    )
  } catch {
    return []
  }
}

/** Reads the single settings row; a missing row or malformed JSON returns defaults instead of throwing. */
export async function getAiSettings(): Promise<AiSettings> {
  try {
    const db = await getWorkbenchDatabase()
    const row = db
      .prepare(
        'SELECT example_questions, custom_instruction, graph_knowledge FROM ai_settings WHERE id = 1'
      )
      .get() as AiSettingsRow | undefined
    if (!row) return { ...EMPTY_SETTINGS }
    return {
      exampleQuestions: parseExampleQuestions(row.example_questions),
      customInstruction: row.custom_instruction ?? '',
      graphKnowledge: row.graph_knowledge ?? ''
    }
  } catch {
    return { ...EMPTY_SETTINGS }
  }
}

export async function saveAiSettings(input: AiSettings): Promise<AiSettings> {
  const exampleQuestions = input.exampleQuestions
    .map((question) => question.trim().slice(0, MAX_QUESTION_LENGTH))
    .filter((question) => question !== '')
    .slice(0, MAX_EXAMPLE_QUESTIONS)
  const customInstruction = input.customInstruction
    .trim()
    .slice(0, MAX_INSTRUCTION_LENGTH)
  const graphKnowledge = input.graphKnowledge
    .trim()
    .slice(0, MAX_KNOWLEDGE_LENGTH)

  const db = await getWorkbenchDatabase()
  db.prepare(
    `UPDATE ai_settings
     SET example_questions = ?, custom_instruction = ?, graph_knowledge = ?, updated_at = ?
     WHERE id = 1`
  ).run(
    JSON.stringify(exampleQuestions),
    customInstruction,
    graphKnowledge,
    new Date().toISOString()
  )

  return { exampleQuestions, customInstruction, graphKnowledge }
}
