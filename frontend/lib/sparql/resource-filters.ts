import type { ResourceRole } from '@/components/resource-manager/types'

const ROLE_FILTER_EXPRESSIONS: Record<ResourceRole, string> = {
  subject: '?subject = ?resource',
  predicate: '?predicate = ?resource',
  object: '?object = ?resource',
  context: '?graph = ?resource',
  all: `?subject = ?resource || ?predicate = ?resource || ?object = ?resource || ?graph = ?resource`
}

export function buildRoleFilterClause(
  role: ResourceRole = 'all',
  options?: {
    resourceVar?: string
    graphVar?: string
  }
): string {
  const expression =
    ROLE_FILTER_EXPRESSIONS[role] ?? ROLE_FILTER_EXPRESSIONS.all
  const resourceVar = options?.resourceVar ?? '?resource'
  const graphVar = options?.graphVar ?? '?graph'
  const clauseExpression = expression
    .replaceAll('?resource', resourceVar)
    .replaceAll('?graph', graphVar)
  return `FILTER(${clauseExpression})`
}

export function buildBlankNodeFilterClause(
  showBlankNodes: boolean,
  options?: {
    resourceVar?: string
    graphVar?: string
  }
): string {
  if (showBlankNodes) {
    return ''
  }

  const resourceVar = options?.resourceVar ?? '?resource'
  const graphVar = options?.graphVar ?? '?graph'

  const subjectGuard = `(!isBlank(?subject) || ?subject = ${resourceVar})`
  const objectGuard = `(!isBlank(?object) || ?object = ${resourceVar})`
  const graphGuard = `(!isBlank(${graphVar}) || ${graphVar} = ${resourceVar})`

  return `FILTER(${subjectGuard} && ${objectGuard} && ${graphGuard})`
}
