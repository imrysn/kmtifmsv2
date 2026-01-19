import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

/**
 * Custom hook for managing assignments
 * Handles fetching, loading states, and automatic refetching
 * 
 * @param {number} userId - User ID to fetch assignments for
 * @param {object} options - Configuration options
 * @returns {object} Assignments data and methods
 * 
 * @example
 * const { assignments, loading, error, refetch } = useAssignments(user.id);
 */
export const useAssignments = (userId, options = {}) => {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    includeComments = false
  } = options;

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAssignments = useCallback(async (silent = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.assignmentsByUser(userId)}`
      );
      const data = await response.json();

      if (data.success) {
        setAssignments(data.assignments || []);
      } else {
        throw new Error(data.message || 'Failed to fetch assignments');
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isMounted) {
        await fetchAssignments();
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [fetchAssignments]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh || !userId) return;

    let isMounted = true;

    const interval = setInterval(() => {
      if (isMounted) {
        fetchAssignments(true); // Silent refresh
      }
    }, refreshInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, fetchAssignments, userId]);

  // Refetch method
  const refetch = useCallback(() => {
    return fetchAssignments(false);
  }, [fetchAssignments]);

  return {
    assignments,
    loading,
    error,
    refetch
  };
};

/**
 * Hook for fetching team assignments with pagination
 * 
 * @param {string} teamName - Team name
 * @param {object} options - Configuration options
 * @returns {object} Team assignments data and methods
 */
export const useTeamAssignments = (teamName, options = {}) => {
  const {
    limit = 20,
    cursor = null,
    autoRefresh = false,
    refreshInterval = 30000
  } = options;

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchTeamAssignments = useCallback(async (silent = false, cursorParam = null) => {
    if (!teamName) {
      setLoading(false);
      return;
    }

    if (!silent) {
      if (cursorParam) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
    }
    setError(null);

    try {
      let url = `${API_BASE_URL}${API_ENDPOINTS.assignmentsByTeam(teamName)}?limit=${limit}`;
      if (cursorParam) {
        url += `&cursor=${cursorParam}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        if (cursorParam) {
          // Append to existing assignments
          setAssignments(prev => [...prev, ...(data.assignments || [])]);
        } else {
          // Replace assignments
          setAssignments(data.assignments || []);
        }
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } else {
        throw new Error(data.message || 'Failed to fetch team assignments');
      }
    } catch (err) {
      console.error('Error fetching team assignments:', err);
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [teamName, limit]);

  // Initial fetch
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isMounted) {
        await fetchTeamAssignments();
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [fetchTeamAssignments]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh || !teamName) return;

    let isMounted = true;

    const interval = setInterval(() => {
      if (isMounted) {
        fetchTeamAssignments(true); // Silent refresh
      }
    }, refreshInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, fetchTeamAssignments, teamName]);

  const loadMore = useCallback(() => {
    if (nextCursor && !loadingMore) {
      return fetchTeamAssignments(false, nextCursor);
    }
  }, [nextCursor, loadingMore, fetchTeamAssignments]);

  const refetch = useCallback(() => {
    return fetchTeamAssignments(false);
  }, [fetchTeamAssignments]);

  return {
    assignments,
    loading,
    loadingMore,
    error,
    hasMore,
    nextCursor,
    loadMore,
    refetch
  };
};

export default useAssignments;
