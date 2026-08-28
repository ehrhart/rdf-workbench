import { executeIsqlWithAuth } from '@/providers/virtuoso/odbc-connection'

type StatValue = string | number | null

export async function sysStat(
  id: string | string[]
): Promise<Record<string, StatValue>> {
  try {
    let sqlQuery: string

    if (Array.isArray(id)) {
      // Handle multiple IDs
      const selectClauses = id.map((item) => `sys_stat('${item}') AS "${item}"`)
      sqlQuery = `SELECT ${selectClauses.join(', ')}`
    } else {
      // Handle single ID
      sqlQuery = `SELECT sys_stat('${id}') AS "${id}"`
    }

    const data = await executeIsqlWithAuth<Record<string, unknown>[]>(sqlQuery)
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
