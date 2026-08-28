import 'server-only'

import { z } from 'zod'

const commonSchema = z.object({
  TRIPLESTORE_PROVIDER: z.enum(['virtuoso', 'qlever']),
  SPARQL_ENDPOINT: z.string().url(),
  SPARQL_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(60_000),
  WORKBENCH_NAME: z.string().min(1).default('RDF Workbench'),
  WORKBENCH_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
})

const virtuosoSchema = commonSchema.extend({
  TRIPLESTORE_PROVIDER: z.literal('virtuoso'),
  VIRTUOSO_ADAPTER_URL: z.string().url(),
  VIRTUOSO_ADAPTER_TOKEN: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  VIRTUOSO_EXPORT_BASE_PATH: z.string().optional(),
  GRAPH_EXPORT_FILE_LIMIT: z.coerce.number().int().positive().optional(),
  GRAPH_EXPORT_POLL_INTERVAL_MS: z.coerce.number().int().positive().optional(),
  GRAPH_EXPORT_POLL_ATTEMPTS: z.coerce.number().int().positive().optional()
})

const qleverSchema = commonSchema.extend({
  TRIPLESTORE_PROVIDER: z.literal('qlever'),
  WORKBENCH_DB_PATH: z.string().min(1),
  BOOTSTRAP_ADMIN_USERNAME: z.string().min(1),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(1),
  QLEVER_ACCESS_TOKEN: z.string().min(1).optional()
})

export type VirtuosoRuntimeConfig = z.infer<typeof virtuosoSchema>
export type QleverRuntimeConfig = z.infer<typeof qleverSchema>
export type RuntimeConfig = VirtuosoRuntimeConfig | QleverRuntimeConfig

let cachedConfig: RuntimeConfig | undefined

/**
 * Runtime-only environment parsing. Keeping this lazy prevents deployment
 * secrets from being required by, or embedded into, the Next.js build.
 */
export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) return cachedConfig

  const provider = z
    .enum(['virtuoso', 'qlever'])
    .parse(process.env.TRIPLESTORE_PROVIDER)
  const schema = provider === 'virtuoso' ? virtuosoSchema : qleverSchema

  cachedConfig = schema.parse(process.env)
  return cachedConfig
}

export function getWorkbenchName(): string {
  return process.env.WORKBENCH_NAME?.trim() || 'RDF Workbench'
}
