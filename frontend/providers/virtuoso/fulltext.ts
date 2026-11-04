'use server'

import { tryCatch } from '@/lib/result'
import type { FTIndexStatus, FTRule } from '@/types'
import { executeIsqlCommand } from './odbc-connection'

const escapeSqlLiteral = (value: string): string => value.replace(/'/g, "''")

export async function getFTRules(): Promise<FTRule[]> {
  const result = await tryCatch(async () =>
    executeIsqlCommand<FTRule[]>(
      'SELECT ROFR_G, ROFR_P, ROFR_REASON FROM DB.DBA.RDF_OBJ_FT_RULES ORDER BY ROFR_REASON, ROFR_G, ROFR_P'
    )
  )

  if (!result.success) {
    console.error('Error fetching FT rules:', result.error)
    throw result.error
  }

  return result.data
}

/**
 * Add a new full-text indexing rule
 * @param graph - Graph IRI or null for all graphs
 * @param predicate - Predicate IRI or null for all predicates
 * @param reason - Reason/application identifier for this rule
 */
export async function addFTRule(
  graph: string | null,
  predicate: string | null,
  reason: string
): Promise<{ success: boolean; added: boolean }> {
  const graphValue = graph ? `'${escapeSqlLiteral(graph)}'` : 'NULL'
  const predicateValue = predicate ? `'${escapeSqlLiteral(predicate)}'` : 'NULL'

  const result = await tryCatch(async () =>
    executeIsqlCommand<Array<{ callret: number }>>(
      `SELECT DB.DBA.RDF_OBJ_FT_RULE_ADD(${graphValue}, ${predicateValue}, '${escapeSqlLiteral(reason)}') as callret`
    )
  )

  if (!result.success) {
    console.error('Error adding FT rule:', result.error)
    throw result.error
  }

  // Returns 1 if rule was added, 0 if it already existed
  const added = result.data[0]?.callret === 1

  return { success: true, added }
}

/**
 * Delete a full-text indexing rule
 * @param graph - Graph IRI or null for all graphs
 * @param predicate - Predicate IRI or null for all predicates
 * @param reason - Reason/application identifier for this rule
 */
export async function deleteFTRule(
  graph: string | null,
  predicate: string | null,
  reason: string
): Promise<{ success: boolean; deleted: boolean }> {
  const graphValue = graph ? `'${escapeSqlLiteral(graph)}'` : 'NULL'
  const predicateValue = predicate ? `'${escapeSqlLiteral(predicate)}'` : 'NULL'

  const result = await tryCatch(async () =>
    executeIsqlCommand<Array<{ callret: number }>>(
      `SELECT DB.DBA.RDF_OBJ_FT_RULE_DEL(${graphValue}, ${predicateValue}, '${escapeSqlLiteral(reason)}') as callret`
    )
  )

  if (!result.success) {
    console.error('Error deleting FT rule:', result.error)
    throw result.error
  }

  // Returns 1 if rule was deleted, 0 if it didn't exist
  const deleted = result.data[0]?.callret === 1

  return { success: true, deleted }
}

export async function rebuildFTIndex(): Promise<{ success: boolean }> {
  const result = await tryCatch(async () =>
    executeIsqlCommand('DB.DBA.VT_INC_INDEX_DB_DBA_RDF_OBJ()')
  )

  if (!result.success) {
    console.error('Error rebuilding FT index:', result.error)
    throw result.error
  }

  return { success: true }
}

/**
 * Set batch update mode for full-text index
 * @param mode - 'manual', 'auto', or 'off'
 * @param interval - Minutes between auto updates (only used when mode is 'auto')
 */
export async function setFTBatchMode(
  mode: 'manual' | 'auto' | 'off',
  interval?: number
): Promise<{ success: boolean }> {
  try {
    if (mode === 'auto') {
      const intervalValue =
        Number.isInteger(interval) && (interval ?? 0) > 0 ? interval : 10
      await executeIsqlCommand(
        `DB.DBA.VT_BATCH_UPDATE('DB.DBA.RDF_OBJ', 'ON', ${intervalValue})`
      )
    } else if (mode === 'off') {
      await executeIsqlCommand(
        `DB.DBA.VT_BATCH_UPDATE('DB.DBA.RDF_OBJ', 'OFF', NULL)`
      )
    } else {
      await executeIsqlCommand(
        `registry_set('DELAY_UPDATE_DB_DBA_RDF_OBJ', 'ON')`
      )
      await executeIsqlCommand(
        `DELETE FROM DB.DBA.SYS_SCHEDULED_EVENT WHERE SE_NAME = 'VT_INC_INDEX_DB_DBA_RDF_OBJ()'`
      )
    }

    return { success: true }
  } catch (error) {
    console.error('Error setting FT batch mode:', error)
    throw error
  }
}

export async function getFTIndexStatus(): Promise<FTIndexStatus> {
  try {
    const registryResults = await executeIsqlCommand<Array<{ mode: string }>>(
      "SELECT registry_get('DELAY_UPDATE_DB_DBA_RDF_OBJ') as mode"
    )

    const mode = registryResults[0]?.mode

    const scheduledResults = await executeIsqlCommand<
      Array<{ SE_INTERVAL: number }>
    >(
      "SELECT SE_INTERVAL FROM DB.DBA.SYS_SCHEDULED_EVENT WHERE SE_NAME = 'VT_INC_INDEX_DB_DBA_RDF_OBJ()'"
    )

    if (!mode || mode === 'OFF') {
      // OFF means real-time updates (triggers fire immediately)
      return {
        batchMode: 'off'
      }
    } else if (mode === 'ON' && scheduledResults.length > 0) {
      return {
        batchMode: 'auto',
        interval: scheduledResults[0].SE_INTERVAL
      }
    } else {
      return {
        batchMode: 'manual'
      }
    }
  } catch (error) {
    console.error('Error fetching FT index status:', error)
    return {
      batchMode: 'manual'
    }
  }
}
