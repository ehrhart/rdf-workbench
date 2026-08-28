/**
 * Type-safe result type for operations that can fail
 */
export type TryCatchSuccess<T> = { success: true; data: T }
export type TryCatchError = { success: false; error: unknown }
export type TryCatchResult<T> = TryCatchSuccess<T> | TryCatchError

/**
 * Wraps an async operation in a try-catch and returns a Result type
 * This avoids unsafe casts and provides clear type narrowing
 */
export const tryCatch = async <T>(
  operation: () => Promise<T>
): Promise<TryCatchResult<T>> => {
  try {
    const data = await operation()
    return { success: true, data }
  } catch (error) {
    return { success: false, error }
  }
}

/**
 * Synchronous version of tryCatch
 */
export const tryCatchSync = <T>(
  operation: () => T
): TryCatchSuccess<T> | TryCatchError => {
  try {
    const data = operation()
    return { success: true, data }
  } catch (error) {
    return { success: false, error }
  }
}
