import 'server-only'

import crypto from 'node:crypto'
import type {
  DatasetProfile,
  ProfileClass,
  ProfileObjectTarget,
  ProfileProperty
} from '@/lib/ai/dataset-profile'
import { buildDatasetProfile } from '@/lib/ai/dataset-profile'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getRuntimeConfig } from '@/lib/runtime/config'
import { getWorkbenchDatabase } from '@/lib/workbench-database'

interface ProfileMetaRow {
  id: string
  provider: string
  endpoint: string
  built_at: string
  triple_count: number | null
  prefixes: string
  graphs: string
}

interface ProfileClassRow {
  iri: string
  label: string | null
  instance_count: number
}

interface ProfilePropertyRow {
  class_iri: string
  iri: string
  usage_count: number
  object_types: string
  samples: string
}

export interface ProfileSummary {
  builtAt: string
  provider: string
  endpoint: string
  classCount: number
  propertyCount: number
  tripleCount: number | null
}

function parseObjectTargets(json: string): ProfileObjectTarget[] {
  try {
    const parsed = JSON.parse(json) as ProfileObjectTarget[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseSamples(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function mapToProfile(
  meta: ProfileMetaRow,
  classRows: ProfileClassRow[],
  propertyRows: ProfilePropertyRow[]
): DatasetProfile {
  const propertiesByClass = new Map<string, ProfileProperty[]>()
  for (const row of propertyRows) {
    const list = propertiesByClass.get(row.class_iri) ?? []
    list.push({
      iri: row.iri,
      count: row.usage_count,
      objectTypes: parseObjectTargets(row.object_types),
      samples: parseSamples(row.samples)
    })
    propertiesByClass.set(row.class_iri, list)
  }

  const classes: ProfileClass[] = classRows.map((row) => ({
    iri: row.iri,
    label: row.label,
    instanceCount: row.instance_count,
    properties: propertiesByClass.get(row.iri) ?? []
  }))

  const looseProperties = propertiesByClass.get('') ?? []

  let prefixes: Record<string, string> = {}
  try {
    const parsed = JSON.parse(meta.prefixes) as Record<string, string>
    if (parsed && typeof parsed === 'object') prefixes = parsed
  } catch {
    prefixes = {}
  }

  let graphs: DatasetProfile['graphs'] = []
  try {
    const parsed = JSON.parse(meta.graphs) as DatasetProfile['graphs']
    if (Array.isArray(parsed)) graphs = parsed
  } catch {
    graphs = []
  }

  return {
    provider: meta.provider as DatasetProfile['provider'],
    endpoint: meta.endpoint,
    builtAt: meta.built_at,
    graphs,
    prefixes,
    tripleCount: meta.triple_count,
    classes,
    looseProperties
  }
}

export async function storeProfile(profile: DatasetProfile): Promise<void> {
  const db = await getWorkbenchDatabase()
  const id = crypto.randomUUID()

  const insertMeta = db.prepare(`
    INSERT INTO dataset_profiles (id, provider, endpoint, built_at, triple_count, prefixes, graphs)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertClass = db.prepare(`
    INSERT INTO profile_classes (profile_id, position, iri, label, instance_count)
    VALUES (?, ?, ?, ?, ?)
  `)
  const insertProperty = db.prepare(`
    INSERT INTO profile_properties
      (profile_id, class_iri, iri, usage_count, object_types, samples)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  db.transaction(() => {
    db.exec('DELETE FROM dataset_profiles')
    insertMeta.run(
      id,
      profile.provider,
      profile.endpoint,
      profile.builtAt,
      profile.tripleCount,
      JSON.stringify(profile.prefixes),
      JSON.stringify(profile.graphs)
    )
    const classRows = profile.classes.map((cls, index) => ({ cls, index }))
    for (const { cls, index } of classRows) {
      insertClass.run(id, index, cls.iri, cls.label, cls.instanceCount)
      for (const property of cls.properties) {
        insertProperty.run(
          id,
          cls.iri,
          property.iri,
          property.count,
          JSON.stringify(property.objectTypes),
          JSON.stringify(property.samples)
        )
      }
    }
    for (const property of profile.looseProperties) {
      insertProperty.run(
        id,
        '',
        property.iri,
        property.count,
        JSON.stringify(property.objectTypes),
        JSON.stringify(property.samples)
      )
    }
  })()
}

export async function loadStoredProfile(): Promise<DatasetProfile | null> {
  const db = await getWorkbenchDatabase()
  const meta = db
    .prepare('SELECT * FROM dataset_profiles ORDER BY built_at DESC LIMIT 1')
    .get() as ProfileMetaRow | undefined
  if (!meta) return null

  const classRows = db
    .prepare(
      'SELECT iri, label, instance_count FROM profile_classes WHERE profile_id = ? ORDER BY position'
    )
    .all(meta.id) as ProfileClassRow[]
  const propertyRows = db
    .prepare(
      'SELECT class_iri, iri, usage_count, object_types, samples FROM profile_properties WHERE profile_id = ?'
    )
    .all(meta.id) as ProfilePropertyRow[]

  const profile = mapToProfile(meta, classRows, propertyRows)
  if (classRows.length > 0) {
    const runtimeConfig = getRuntimeConfig()
    profile.endpoint = runtimeConfig.SPARQL_ENDPOINT
  }
  return profile
}

let buildingProfile: Promise<DatasetProfile | null> | undefined

/**
 * Prefixes always come from the live prefix table (Namespaces-page edits
 * must reach the prompt); only the introspected vocabulary is the
 * build-time snapshot.
 */
export async function withLivePrefixes(
  profile: DatasetProfile | null
): Promise<DatasetProfile | null> {
  if (!profile) return null
  const runtime = await getWorkbenchRuntime()
  const prefixes = await runtime.prefixes
    .list()
    .catch(() => ({}) as Record<string, string>)
  return { ...profile, prefixes }
}

/** Latest stored profile, or a freshly built one. */
export async function loadOrBuildProfile(): Promise<DatasetProfile | null> {
  const stored = await loadStoredProfile()
  if (stored && stored.classes.length > 0) return stored

  buildingProfile ??= buildDatasetProfile()
    .then(async (profile) => {
      await storeProfile(profile)
      return profile
    })
    .catch((error) => {
      console.error('[ask] profile build failed:', error)
      return null
    })
    .finally(() => {
      buildingProfile = undefined
    })
  return buildingProfile
}

export async function rebuildProfile(): Promise<DatasetProfile> {
  const profile = await buildDatasetProfile()
  await storeProfile(profile)
  return profile
}

export async function getProfileSummary(): Promise<ProfileSummary | null> {
  const db = await getWorkbenchDatabase()
  const meta = db
    .prepare(
      `SELECT
        d.built_at,
        d.provider,
        d.endpoint,
        d.triple_count,
        (SELECT COUNT(*) FROM profile_classes c WHERE c.profile_id = d.id) AS class_count,
        (SELECT COUNT(*) FROM profile_properties p WHERE p.profile_id = d.id) AS property_count
      FROM dataset_profiles d
      ORDER BY d.built_at DESC
      LIMIT 1`
    )
    .get() as
    | {
        built_at: string
        provider: string
        endpoint: string
        triple_count: number | null
        class_count: number
        property_count: number
      }
    | undefined
  if (!meta) return null
  return {
    builtAt: meta.built_at,
    provider: meta.provider,
    endpoint: meta.endpoint,
    classCount: meta.class_count,
    propertyCount: meta.property_count,
    tripleCount: meta.triple_count
  }
}
