import React from 'react'
import './CommentsModal.css'

const CommentsModal = ({
  isOpen,
  onClose,
  assignment,
  comments,
  loadingComments,
  newComment,
  setNewComment,
  onPostComment,
  replyingTo,
  setReplyingTo,
  replyText,
  setReplyText,
  onPostReply,
  visibleReplies,
  toggleRepliesVisibility,
  getInitials,
  formatTimeAgo,
  user
}) => {
  if (!isOpen || !assignment) return null

  return (
    <div className="comments-modal-overlay" onClick={onClose}>
      <div className="comments-modal" onClick={(e) => e.stopPropagation()}>
        <div className="comments-modal-header">
          <h3>Comments - {assignment.title}</h3>
          <button className="close-modal-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="comments-modal-body">
          {loadingComments ? (
            <div className="loading-comments">
              <div className="spinner"></div>
              <p>Loading comments...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="no-comments">
              <p>💬 No comments yet. Be the first to comment!</p>
            </div>
          ) : (
            <div className="comments-list">
              {comments.map(comment => (
                <div key={comment.id} className="comment-thread" data-comment-id={comment.id}>
                  {/* Main Comment */}
                  <div className="comment-item">
                    <div className="comment-avatar">
                      {getInitials(comment.user_fullname || comment.username)}
                    </div>
                    <div className="comment-content">
                      <div className="comment-header">
                        <span className="comment-author">{comment.user_fullname || comment.username}</span>
                        <span className={`role-badge ${comment.user_role ? comment.user_role.toLowerCase().replace(' ', '-') : 'user'}`}>
                          {comment.user_role || 'USER'}
                        </span>
                        <span className="comment-time">{formatTimeAgo(comment.created_at)}</span>
                      </div>
                      <div className="comment-text">{comment.comment}</div>

                      {/* Action Buttons */}
                      <div className="comment-actions">
                        <button
                          className="reply-button"
                          onClick={() => setReplyingTo(comment.id)}
                        >
                          Reply
                        </button>

                        {/* View Replies Button */}
                        {comment.replies && comment.replies.length > 0 && (
                          <button
                            className="view-replies-button"
                            onClick={() => toggleRepliesVisibility(comment.id)}
                          >
                            {visibleReplies[comment.id] ? 'Hide' : 'View'} {comment.replies.length}{' '}
                            {comment.replies.length === 1 ? 'reply' : 'replies'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Replies Thread */}
                  {comment.replies && comment.replies.length > 0 && visibleReplies[comment.id] && (
                    <div className="replies-thread">
                      {comment.replies.map(reply => (
                        <div key={reply.id} className="reply-item">
                          <div className="reply-avatar">
                            {getInitials(reply.user_fullname || reply.username)}
                          </div>
                          <div className="reply-content">
                            <div className="reply-header">
                              <span className="reply-author">{reply.user_fullname || reply.username}</span>
                              <span className={`role-badge ${reply.user_role ? reply.user_role.toLowerCase().replace(' ', '-') : 'user'}`}>
                                {reply.user_role || 'USER'}
                              </span>
                              <span className="reply-time">{formatTimeAgo(reply.created_at)}</span>
                            </div>
                            <div className="reply-text">{reply.reply}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Input Box */}
                  {replyingTo === comment.id && (
                    <div className="reply-input-box">
                      <div className="comment-avatar reply-avatar">
                        {getInitials(user.username || user.fullName)}
                      </div>
                      <div className="comment-input-wrapper">
                        <input
                          type="text"
                          className="comment-input"
                          placeholder="Write a reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              onPostReply(e, comment.id);
                            }
                          }}
                          disabled={false}
                          autoFocus
                        />
                        <button
                          className="comment-submit-btn"
                          onClick={(e) => onPostReply(e, comment.id)}
                          disabled={!replyText.trim()}
                        >
                          ➤
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comment Form */}
        <div className="comments-modal-footer">
          <div className="add-comment">
            <div className="comment-avatar">
              {getInitials(user.username || user.fullName)}
            </div>
            <div className="comment-input-wrapper">
              <input
                type="text"
                className="comment-input"
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onPostComment(e);
                  }
                }}
              />
              <button
                className="comment-submit-btn"
                onClick={onPostComment}
                disabled={!newComment.trim()}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommentsModal
