import { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../../services/adminService';
import { API_BASE_URL } from '@/config/api';

/**
 * Hook for managing admin task assignments
 */
export const useAdminTasks = (user, { setError, setSuccess, clearMessages }) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isOpeningFile, setIsOpeningFile] = useState(false);

  // Comments state
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  const fetchInitialAssignments = useCallback(async () => {
    try {
      setLoading(true);
      clearMessages();
      const data = await adminService.getAssignments({ limit: 20 });

      if (data.success) {
        setAssignments(data.assignments || []);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } else {
        setError(data.message || 'Failed to fetch assignments');
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [setError, clearMessages]);

  const fetchMoreAssignments = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) {
      return;
    }

    try {
      setLoadingMore(true);
      const data = await adminService.getAssignments({ cursor: nextCursor, limit: 20 });

      if (data.success) {
        const newAssignments = data.assignments || [];
        setAssignments(prev => [...prev, ...newAssignments]);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } else {
        setError(data.message || 'Failed to fetch more assignments');
      }
    } catch (error) {
      console.error('Error fetching more assignments:', error);
      setError('Failed to load more assignments');
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, hasMore, loadingMore, setError]);

  const fetchComments = useCallback(async (assignmentId) => {
    try {
      setLoadingComments(true);
      const data = await adminService.getComments(assignmentId);

      if (data.success) {
        setComments(data.comments || []);
      } else {
        setError(data.message || 'Failed to load comments');
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  }, [setError]);

  const openCommentsModal = useCallback((assignment) => {
    setSelectedAssignment(assignment);
    setShowCommentsModal(true);
    fetchComments(assignment.id);
  }, [fetchComments]);

  const closeCommentsModal = useCallback(() => {
    setShowCommentsModal(false);
    setSelectedAssignment(null);
    setComments([]);
  }, []);

  const postComment = useCallback(async (commentText) => {
    if (!commentText.trim() || !selectedAssignment || !user) {
      return;
    }

    const optimisticComment = {
      id: `temp-${Date.now()}`,
      comment: commentText,
      user_id: user.id,
      username: user.username,
      user_fullname: user.fullName,
      user_role: user.role,
      created_at: new Date().toISOString(),
      replies: []
    };

    setComments(prev => [...prev, optimisticComment]);

    try {
      const data = await adminService.postComment(selectedAssignment.id, {
        userId: user.id,
        username: user.username,
        comment: commentText
      });

      if (data.success) {
        await fetchComments(selectedAssignment.id);
        setSuccess('Comment posted successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
        setError(data.message || 'Failed to post comment');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      setError('Failed to post comment');
    }
  }, [user, selectedAssignment, fetchComments, setError, setSuccess]);

  const postReply = useCallback(async (commentId, replyText) => {
    if (!replyText.trim() || !selectedAssignment || !user) {
      return;
    }

    const optimisticReply = {
      id: `temp-${Date.now()}`,
      reply: replyText,
      user_id: user.id,
      username: user.username,
      user_fullname: user.fullName,
      user_role: user.role,
      created_at: new Date().toISOString()
    };

    setComments(prev => prev.map(comment =>
      comment.id === commentId
        ? { ...comment, replies: [...(comment.replies || []), optimisticReply] }
        : comment
    ));

    try {
      const data = await adminService.postReply(selectedAssignment.id, commentId, {
        userId: user.id,
        username: user.username,
        reply: replyText
      });

      if (data.success) {
        await fetchComments(selectedAssignment.id);
        setSuccess('Reply posted successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setComments(prev => prev.map(comment =>
          comment.id === commentId
            ? { ...comment, replies: (comment.replies || []).filter(r => r.id !== optimisticReply.id) }
            : comment
        ));
        setError(data.message || 'Failed to post reply');
      }
    } catch (error) {
      console.error('Error posting reply:', error);
      setError('Failed to post reply');
    }
  }, [user, selectedAssignment, fetchComments, setError, setSuccess]);

  const deleteAssignment = useCallback(async (assignmentId) => {
    try {
      clearMessages();
      setSuccess('Deleting assignment...');
      const data = await adminService.deleteAssignment(assignmentId);

      if (data.success) {
        setAssignments(prev => prev.filter(a => a.id !== assignmentId));
        setSuccess('Assignment deleted successfully');
        return true;
      } else {
        setError(data.message || 'Failed to delete assignment');
        return false;
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      setError('Failed to delete assignment');
      return false;
    } finally {
      setTimeout(() => setSuccess(''), 3000);
    }
  }, [setError, setSuccess, clearMessages]);

  const handleOpenFile = async (file) => {
    if (!file) {
      return;
    }

    try {
      setIsOpeningFile(true);
      clearMessages();
      setSuccess('Opening file...');

      // Small delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check if running in Electron
      const isElectron = window.electron && window.electron.openFileInApp;

      if (isElectron) {
        console.log('💻 Running in Electron - using Windows default application');

        const pathData = await adminService.getFilePath(file.id);

        if (!pathData.success) {
          throw new Error(pathData.message || 'Failed to get file path');
        }

        const result = await window.electron.openFileInApp(pathData.filePath);

        if (result.success) {
          setSuccess('File opened successfully');
        } else {
          throw new Error(result.error || 'Failed to open file');
        }
      } else {
        console.log('🌐 Running in browser - opening in new tab');
        // API_BASE_URL needs to be defined, e.g., imported from a config file
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || ''; // Placeholder if not imported
        const fileUrl = `${API_BASE_URL}${file.file_path || file.filePath}`;
        const newWindow = window.open(fileUrl, '_blank');

        if (!newWindow) {
          throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
        }

        newWindow.focus();
        setSuccess('File opened in browser');
      }
    } catch (error) {
      console.error('❌ Error opening file:', error);
      setSuccess('');
      setError(`Error opening file: ${error.message || 'Failed to open file'}`);
    } finally {
      setIsOpeningFile(false);
    }
  };

  return {
    assignments,
    loading,
    loadingMore,
    hasMore,
    fetchInitialAssignments,
    fetchMoreAssignments,
    deleteAssignment,
    // Comments
    comments,
    loadingComments,
    selectedAssignment,
    showCommentsModal,
    openCommentsModal,
    closeCommentsModal,
    postComment,
    postReply,
    // File opening
    handleOpenFile,
    isOpeningFile
  };
};
