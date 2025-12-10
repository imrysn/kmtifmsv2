import { useState, useCallback } from 'react'

/**
 * Custom hook for optimistic UI updates
 * 
 * @param {Function} updateFn - Async function that performs the actual update
 * @returns {object} State and methods for optimistic updates
 * 
 * @example
 * const { 
 *   data, 
 *   isUpdating, 
 *   error,
 *   updateOptimistically 
 * } = useOptimisticUpdate()
 * 
 * const handleLike = async () => {
 *   await updateOptimistically(
 *     // Optimistic update
 *     (prevData) => ({ ...prevData, likes: prevData.likes + 1 }),
 *     // Actual API call
 *     () => api.likePost(postId),
 *     // Rollback on error
 *     (prevData) => ({ ...prevData, likes: prevData.likes - 1 })
 *   )
 * }
 */
export const useOptimisticUpdate = (initialData = null) => {
  const [data, setData] = useState(initialData)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState(null)

  const updateOptimistically = useCallback(async (
    optimisticUpdate,
    actualUpdate,
    rollbackUpdate = null
  ) => {
    setIsUpdating(true)
    setError(null)

    // Store previous state for rollback
    const previousData = data

    try {
      // Apply optimistic update immediately
      if (typeof optimisticUpdate === 'function') {
        setData(optimisticUpdate(previousData))
      } else {
        setData(optimisticUpdate)
      }

      // Perform actual update
      const result = await actualUpdate()

      // Update with actual data if provided
      if (result && result.data) {
        setData(result.data)
      }

      return { success: true, data: result }
    } catch (err) {
      console.error('Optimistic update failed:', err)
      setError(err.message || 'Update failed')

      // Rollback to previous state or use custom rollback
      if (rollbackUpdate) {
        if (typeof rollbackUpdate === 'function') {
          setData(rollbackUpdate(previousData))
        } else {
          setData(rollbackUpdate)
        }
      } else {
        setData(previousData)
      }

      return { success: false, error: err }
    } finally {
      setIsUpdating(false)
    }
  }, [data])

  const setOptimisticData = useCallback((newData) => {
    setData(newData)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    data,
    setData: setOptimisticData,
    isUpdating,
    error,
    updateOptimistically,
    clearError
  }
}

export default useOptimisticUpdate
