import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { apiFetch } from '@/config/api'

// ─── Query key factory ────────────────────────────────────────────────────────
export const adminTaskKeys = {
  all:    () => ['adminTasks'],
  page:   (cursor) => ['adminTasks', 'page', cursor ?? 'initial'],
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────
const fetchAdminTasks = async (cursor = null) => {
  const url = cursor
    ? `/api/assignments/admin/all?cursor=${cursor}`
    : `/api/assignments/admin/all`
  const data = await apiFetch(url)
  if (!data.success) throw new Error(data.message || 'Failed to fetch assignments')
  return {
    assignments: data.assignments || [],
    nextCursor:  data.nextCursor  ?? null,
    hasMore:     data.hasMore     ?? false,
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
/**
 * useAdminTasks
 *
 * Wraps the admin assignments endpoint in React Query so the data is:
 *   • Served instantly from cache on re-visits (staleTime = 2 min)
 *   • Quietly revalidated in the background after going stale
 *   • Kept in memory for 10 min even when the component unmounts
 *   • Invalidatable after mutations (delete, status change, etc.)
 *
 * The hook accumulates paginated pages into one flat `assignments` array,
 * matching the previous manual useState pattern so TaskManagement.jsx needs
 * minimal changes.
 */
export const useAdminTasks = () => {
  const queryClient = useQueryClient()

  // ── Initial page ────────────────────────────────────────────────────────
  const {
    data,
    isLoading: loading,
    isFetching,
    error,
    refetch: refetchQuery,
  } = useQuery({
    queryKey:  adminTaskKeys.page(null),
    queryFn:   () => fetchAdminTasks(null),
    staleTime: 2 * 60 * 1000,   // serve from cache for 2 min before background refetch
    gcTime:    10 * 60 * 1000,  // keep in memory 10 min after unmount
    refetchOnWindowFocus: false,
    refetchOnReconnect:   true,
    // Show cached data instantly while revalidating in background
    placeholderData: (prev) => prev,
  })

  // ── Load-more: merge new page into the cached initial page ─────────────
  const loadMore = useCallback(async (cursor) => {
    if (!cursor) return
    try {
      const more = await fetchAdminTasks(cursor)
      // Merge into the existing cache entry for the initial page
      queryClient.setQueryData(adminTaskKeys.page(null), (old) => {
        if (!old) return more
        return {
          assignments: [...old.assignments, ...more.assignments],
          nextCursor:  more.nextCursor,
          hasMore:     more.hasMore,
        }
      })
    } catch (err) {
      console.error('useAdminTasks loadMore error:', err)
    }
  }, [queryClient])

  // ── Force a fresh fetch (e.g. after deleting a task) ───────────────────
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminTaskKeys.all() })
  }, [queryClient])

  // ── Optimistic removal (instant UI update before server confirms) ───────
  const removeAssignment = useCallback((id) => {
    queryClient.setQueryData(adminTaskKeys.page(null), (old) => {
      if (!old) return old
      return {
        ...old,
        assignments: old.assignments.filter((a) => a.id !== id),
      }
    })
  }, [queryClient])

  // ── Optimistic field update (e.g. status change) ────────────────────────
  const updateAssignment = useCallback((id, patch) => {
    queryClient.setQueryData(adminTaskKeys.page(null), (old) => {
      if (!old) return old
      return {
        ...old,
        assignments: old.assignments.map((a) =>
          a.id === id ? { ...a, ...patch } : a
        ),
      }
    })
  }, [queryClient])

  return {
    assignments:  data?.assignments  ?? [],
    nextCursor:   data?.nextCursor   ?? null,
    hasMore:      data?.hasMore      ?? false,
    loading,
    isFetching,   // true during background revalidation
    error:        error?.message ?? null,
    loadMore,
    refetch,
    removeAssignment,
    updateAssignment,
  }
}
