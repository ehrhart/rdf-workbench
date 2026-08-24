import 'server-only'

import type { SavedQueryRepository } from '@/lib/runtime/contracts'
import {
  createSavedQuery,
  deleteSavedQuery,
  getSavedQueryById,
  listSavedQueries,
  reorderSavedQueries,
  updateSavedQuery
} from './database-saved-queries'

export const virtuosoSavedQueryRepository: SavedQueryRepository = {
  list: listSavedQueries,
  get: getSavedQueryById,
  create(input, owner) {
    return createSavedQuery(input, owner)
  },
  update(id, input, owner) {
    return updateSavedQuery(id, input, owner)
  },
  delete(id, owner) {
    return deleteSavedQuery(id, owner)
  },
  reorder(order, owner) {
    return reorderSavedQueries(order, owner)
  }
}
