import { useState, useCallback } from 'react';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

/**
 * Custom hook for managing assignment comments
 * Handles fetching, posting, and replying to comments
 * 
 * @param {number} assignmentId - Assignment ID
 * @returns {object} Comments data and methods
 * 
 * @example
 * const { 
 *   comments, 
 *   loading, 
 *   postComment, 
 *   postReply 
 * } = useComments(assignmentId);
 */
export const useComments = (assignmentId = null) => {
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch comments for a specific assignment
   */
  const fetchComments = useCallback(async (id) => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.assignmentComments(id)}`
      );
      const data = await response.json();

      if (data.success) {
        setComments(prev => ({
          ...prev,
          [id]: data.comments || []
        }));
      } else {
        throw new Error(data.message || 'Failed to fetch comments');
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch comments for multiple assignments at once
   * More efficient than individual fetches
   */
  const fetchMultipleComments = useCallback(async (assignmentIds) => {
    if (!assignmentIds || assignmentIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all comments in parallel
      const promises = assignmentIds.map(id =>
        fetch(`${API_BASE_URL}${API_ENDPOINTS.assignmentComments(id)}`)
          .then(res => res.json())
          .then(data => ({ id, comments: data.success ? data.comments : [] }))
      );

      const results = await Promise.all(promises);

      // Update comments state with all results
      const commentsMap = {};
      results.forEach(({ id, comments: assignmentComments }) => {
        commentsMap[id] = assignmentComments;
      });

      setComments(prev => ({ ...prev, ...commentsMap }));
    } catch (err) {
      console.error('Error fetching multiple comments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Post a new comment
   */
  const postComment = useCallback(async (id, userId, username, commentText) => {
    if (!id || !commentText.trim()) return { success: false };

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.assignmentComments(id)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            username,
            comment: commentText
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        // Refresh comments for this assignment
        await fetchComments(id);
        return { success: true };
      } else {
        throw new Error(data.message || 'Failed to post comment');
      }
    } catch (err) {
      console.error('Error posting comment:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [fetchComments]);

  /**
   * Post a reply to a comment
   */
  const postReply = useCallback(async (assignmentId, commentId, userId, username, replyText) => {
    if (!assignmentId || !commentId || !replyText.trim()) {
      return { success: false };
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.assignmentCommentReply(assignmentId, commentId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            username,
            reply: replyText
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        // Refresh comments for this assignment
        await fetchComments(assignmentId);
        return { success: true };
      } else {
        throw new Error(data.message || 'Failed to post reply');
      }
    } catch (err) {
      console.error('Error posting reply:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [fetchComments]);

  /**
   * Get comments for a specific assignment
   */
  const getComments = useCallback((id) => {
    return comments[id] || [];
  }, [comments]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    comments,
    loading,
    error,
    fetchComments,
    fetchMultipleComments,
    postComment,
    postReply,
    getComments,
    clearError
  };
};

export default useComments;
