'use server'

import { executeIsqlCommand } from '@/providers/virtuoso/odbc-connection'
import { allSystemVariables } from './variables'

type StatValue = string | number | null

const allowedVariables = new Set(allSystemVariables)

export async function sysStat(
  id: string | string[]
): Promise<Record<string, StatValue>> {
  const ids = Array.isArray(id) ? id : [id]
  for (const requested of ids) {
    if (!allowedVariables.has(requested)) {
      throw new Error('Unknown system variable')
    }
  }

  try {
    const selectClauses = ids.map((item) => `sys_stat('${item}') AS "${item}"`)
    const sqlQuery = `SELECT ${selectClauses.join(', ')}`

    const data = await executeIsqlCommand<Record<string, unknown>[]>(sqlQuery)
    const result = data[0]
    const keys = Object.keys(result)
    const values = Object.values(result)
    return keys.reduce<Record<string, StatValue>>((acc, key, index) => {
      const value = values[index]
      acc[key] =
        typeof value === 'string' || typeof value === 'number' ? value : null
      return acc
    }, {})
  } catch (error) {
    console.error('Error executing sys_stat:', error)
    throw new Error('Failed to execute sys_stat')
  }
}
