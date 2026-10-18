import 'server-only'

import { z } from 'zod'
import { TRIPLESTORE_PROVIDERS, type TriplestoreProvider } from './contracts'

const commonSchema = z.object({
  TRIPLESTORE_PROVIDER: z.enum(TRIPLESTORE_PROVIDERS),
  SPARQL_ENDPOINT: z.string().url(),
  SPARQL_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(60_000),
  WORKBENCH_NAME: z.string().min(1).default('RDF Workbench'),
  WORKBENCH_URL: z.string().url(),
  RESOURCE_BASE_URI: z.string().url(),
  DEREFERENCE_PATHS: z.string().optional(),
  WORKBENCH_DB_PATH: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
})

const virtuosoSchema = commonSchema.extend({
  TRIPLESTORE_PROVIDER: z.literal('virtuoso'),
  BOOTSTRAP_ADMIN_USERNAME: z.string().min(1),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(1),
  VIRTUOSO_ADAPTER_URL: z.string().url(),
  VIRTUOSO_ADAPTER_TOKEN: z.string().min(32),
  VIRTUOSO_EXPORT_BASE_PATH: z.string().optional(),
  GRAPH_EXPORT_FILE_LIMIT: z.coerce.number().int().positive().optional(),
  GRAPH_EXPORT_POLL_INTERVAL_MS: z.coerce.number().int().positive().optional(),
  GRAPH_EXPORT_POLL_ATTEMPTS: z.coerce.number().int().positive().optional()
})

const qleverSchema = commonSchema.extend({
  TRIPLESTORE_PROVIDER: z.literal('qlever'),
  BOOTSTRAP_ADMIN_USERNAME: z.string().min(1),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(1)
})

const oxigraphSchema = commonSchema.extend({
  TRIPLESTORE_PROVIDER: z.literal('oxigraph'),
  BOOTSTRAP_ADMIN_USERNAME: z.string().min(1),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(1)
})

const genericSchema = commonSchema.extend({
  TRIPLESTORE_PROVIDER: z.literal('generic'),
  BOOTSTRAP_ADMIN_USERNAME: z.string().min(1),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(1)
})

export type VirtuosoRuntimeConfig = z.infer<typeof virtuosoSchema>
export type QleverRuntimeConfig = z.infer<typeof qleverSchema>
export type OxigraphRuntimeConfig = z.infer<typeof oxigraphSchema>
export type GenericRuntimeConfig = z.infer<typeof genericSchema>
export type RuntimeConfig =
  | VirtuosoRuntimeConfig
  | QleverRuntimeConfig
  | OxigraphRuntimeConfig
  | GenericRuntimeConfig

type RuntimeSchema =
  | typeof virtuosoSchema
  | typeof qleverSchema
  | typeof oxigraphSchema
  | typeof genericSchema

const providerSchemas = {
  virtuoso: virtuosoSchema,
  qlever: qleverSchema,
  oxigraph: oxigraphSchema,
  generic: genericSchema
} satisfies Record<TriplestoreProvider, RuntimeSchema>

let cachedConfig: RuntimeConfig | undefined

/**
 * Runtime-only environment parsing. Keeping this lazy prevents deployment
 * secrets from being required by, or embedded into, the Next.js build.
 */
export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) return cachedConfig

  const provider = z
    .enum(TRIPLESTORE_PROVIDERS)
    .parse(process.env.TRIPLESTORE_PROVIDER)
  const schema = providerSchemas[provider]

  cachedConfig = schema.parse(process.env)
  return cachedConfig
}

export function getWorkbenchName(): string {
  return process.env.WORKBENCH_NAME?.trim() || 'RDF Workbench'
}
