import { useState, useEffect, useRef, useCallback } from 'react'
import './TaskManagement.css'
import { AlertMessage, ConfirmationModal, CommentsModal, FileOpenModal } from './modals'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'
import { useAdminTasks } from '../../hooks/admin/useAdminTasks'
import TaskCard from './task-management/TaskCard'
import { getInitials, formatTimeAgo } from '../../utils/adminUtils'

const TaskManagement = ({ error, success, setError, setSuccess, clearMessages, user, contextAssignmentId }) => {
  const { isConnected } = useNetwork()
  const {
    assignments,
    loading,
    loadingMore,
    hasMore,
    fetchInitialAssignments,
    fetchMoreAssignments,
    deleteAssignment,
    comments,
    loadingComments,
    selectedAssignment,
    showCommentsModal,
    openCommentsModal,
    closeCommentsModal,
    postComment,
    postReply,
    handleOpenFile,
    isOpeningFile
  } = useAdminTasks(user, { setError, setSuccess, clearMessages })

  const [expandedAssignments, setExpandedAssignments] = useState({})
  const [expandedAttachments, setExpandedAttachments] = useState({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [assignmentToDelete, setAssignmentToDelete] = useState(null)
  const [showMenuForAssignment, setShowMenuForAssignment] = useState(null)
  const [showFileOpenModal, setShowFileOpenModal] = useState(false)
  const [fileToConfirm, setFileToConfirm] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [visibleReplies, setVisibleReplies] = useState({})

  // Ref for infinite scroll
  const observerRef = useRef(null)
  const loadMoreRef = useRef(null)

  useEffect(() => {
    fetchInitialAssignments()
  }, [fetchInitialAssignments])

  // Handle context from notifications
  useEffect(() => {
    if (contextAssignmentId && typeof contextAssignmentId === 'object' && assignments.length > 0) {
      const { assignmentId, commentId, shouldOpenComments } = contextAssignmentId
      if (assignmentId && shouldOpenComments) {
        const assignment = assignments.find(a => a.id === assignmentId)
        if (assignment) {
          openCommentsModal(assignment)
          if (commentId) {
            setTimeout(() => {
              const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`)
              if (commentElement) {
                commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                commentElement.classList.add('highlight-comment')
                setTimeout(() => commentElement.classList.remove('highlight-comment'), 2000)
              }
            }, 500)
          }
        }
      }
    }
  }, [contextAssignmentId, assignments, openCommentsModal])

  // Infinite scroll
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return
    const options = { root: null, rootMargin: '100px', threshold: 0.1 }
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchMoreAssignments()
      }
    }, options)
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current)
    return () => observerRef.current?.disconnect()
  }, [loading, loadingMore, hasMore, fetchMoreAssignments])

  // Click outside menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenuForAssignment && !event.target.closest('.admin-card-menu')) {
        setShowMenuForAssignment(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenuForAssignment])

  const toggleExpand = (assignmentId) => {
    setExpandedAssignments(prev => ({ ...prev, [assignmentId]: !prev[assignmentId] }))
  }

  const toggleAttachments = (assignmentId) => {
    setExpandedAttachments(prev => ({ ...prev, [assignmentId]: !prev[assignmentId] }))
  }

  const toggleRepliesVisibility = useCallback((commentId) => {
    setVisibleReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }))
  }, [])

  const handlePostCommentLocal = (e) => {
    e.preventDefault()
    postComment(newComment)
    setNewComment('')
  }

  const handlePostReplyLocal = (e, commentId) => {
    e.preventDefault()
    postReply(commentId, replyText)
    setReplyText('')
    setReplyingTo(null)
  }

  const onOpenFileClick = (file) => {
    setFileToConfirm(file)
    setShowFileOpenModal(true)
  }

  const handleConfirmOpenFile = () => {
    handleOpenFile(fileToConfirm)
    setShowFileOpenModal(false)
    setFileToConfirm(null)
  }

  if (loading) {
    return (
      <div className="task-management-container">
        <div className="task-feed">
          <div className="feed-header-simple"><h2>All Tasks</h2></div>
          <div className="task-count">Loading...</div>
          <div className="feed-container">
            <div className="loading-skeleton">
              {[1, 2, 3].map(i => <div key={i} className="skeleton-assignment-card" />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`task-management-container ${isOpeningFile ? 'file-opening-cursor' : ''}`}>
      {error && <AlertMessage type="error" message={error} onClose={clearMessages} />}
      {success && <AlertMessage type="success" message={success} onClose={clearMessages} />}

      <div className="task-feed">
        <div className="feed-header-simple"><h2>All Tasks</h2></div>
        <div className="task-count">
          {assignments.length} task{assignments.length !== 1 ? 's' : ''}
          {hasMore && ' • Scroll for more'}
        </div>

        <div className="feed-container">
          {assignments.length === 0 ? (
            <div className="empty-feed">
              <div className="empty-icon">📭</div>
              <h3>No Tasks Yet</h3>
              <p>Team leaders haven't created any assignments yet.</p>
            </div>
          ) : (
            <>
              {assignments.map(assignment => (
                <TaskCard
                  key={assignment.id}
                  assignment={assignment}
                  expandedAssignments={expandedAssignments}
                  toggleExpand={() => openCommentsModal(assignment)}
                  expandedAttachments={expandedAttachments}
                  toggleAttachments={toggleAttachments}
                  onDelete={() => { setAssignmentToDelete(assignment); setShowDeleteModal(true) }}
                  onOpenFile={onOpenFileClick}
                  showMenuForAssignment={showMenuForAssignment}
                  setShowMenuForAssignment={setShowMenuForAssignment}
                />
              ))}
              <div ref={loadMoreRef} className="load-more-trigger">
                {loadingMore && <div className="loading-more">Loading more tasks...</div>}
              </div>
            </>
          )}
        </div>
      </div>

      <CommentsModal
        isOpen={showCommentsModal}
        onClose={closeCommentsModal}
        assignment={selectedAssignment}
        comments={comments}
        loadingComments={loadingComments}
        newComment={newComment}
        setNewComment={setNewComment}
        onPostComment={handlePostCommentLocal}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        replyText={replyText}
        setReplyText={setReplyText}
        onPostReply={handlePostReplyLocal}
        visibleReplies={visibleReplies}
        toggleRepliesVisibility={toggleRepliesVisibility}
        getInitials={getInitials}
        formatTimeAgo={formatTimeAgo}
        user={user}
      />

      {showDeleteModal && (
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => { setShowDeleteModal(false); setAssignmentToDelete(null) }}
          onConfirm={async () => {
            const success = await deleteAssignment(assignmentToDelete.id)
            if (success) setShowDeleteModal(false)
          }}
          title="Delete Assignment"
          message={`Are you sure you want to delete "${assignmentToDelete?.title}"? This will also delete all associated files.`}
          confirmText="Delete"
          variant="danger"
          isLoading={loading}
        />
      )}

      <FileOpenModal
        isOpen={showFileOpenModal}
        onClose={() => { setShowFileOpenModal(false); setFileToConfirm(null) }}
        onConfirm={handleConfirmOpenFile}
        fileName={fileToConfirm?.original_name}
        isOpeningFile={isOpeningFile}
      />
    </div>
  )
}

export default withErrorBoundary(TaskManagement, { componentName: 'Task Management' })
