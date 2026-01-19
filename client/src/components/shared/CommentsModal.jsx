import React, { memo, useCallback, useState } from 'react';
import './CommentsModal.css';

// Memoized Comment component to prevent unnecessary re-renders
const CommentItem = memo(({ 
  comment, 
  replyingTo, 
  setReplyingTo, 
  visibleReplies, 
  toggleRepliesVisibility, 
  getInitials, 
  formatTimeAgo,
  replyText,
  setReplyText,
  onPostReply,
  user,
  highlightUsername
}) => {
  const MAX_COMMENT_LENGTH = 150;
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongComment = comment.comment.length > MAX_COMMENT_LENGTH;

  // Check if this comment should be highlighted
  const isHighlighted = highlightUsername && 
    (comment.username === highlightUsername || comment.user_fullname === highlightUsername);

  const handleReplyClick = useCallback(() => {
    setReplyingTo(comment.id);
  }, [comment.id, setReplyingTo]);

  const handleToggleReplies = useCallback(() => {
    toggleRepliesVisibility(comment.id);
  }, [comment.id, toggleRepliesVisibility]);

  return (
    <div 
      className={`comment-thread ${isHighlighted ? 'highlight-comment' : ''}`}
      data-comment-id={comment.id}
    >
      {/* Main Comment */}
      <div className="comment-item">
        <div className="comment-avatar">
          {getInitials(comment.user_fullname || comment.fullName || comment.username)}
        </div>
        <div className="comment-content">
          <div className="comment-header">
            <span className="comment-author">
              {comment.user_fullname || comment.fullName || comment.username}
            </span>
            <span className={`role-badge ${comment.user_role ? comment.user_role.toLowerCase().replace(' ', '-').replace('_', '-') : 'user'}`}>
              {comment.user_role || 'USER'}
            </span>
            <span className="comment-time">{formatTimeAgo(comment.created_at)}</span>
          </div>
          <div className="comment-text">
            {isLongComment && !isExpanded
              ? comment.comment.substring(0, MAX_COMMENT_LENGTH) + '...'
              : comment.comment}
            {isLongComment && (
              <button
                className="see-more-btn"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? 'See less' : 'See more'}
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="comment-actions">
            <button
              className="reply-button"
              onClick={handleReplyClick}
            >
              Reply
            </button>

            {/* View Replies Button */}
            {comment.replies && comment.replies.length > 0 && (
              <button
                className="view-replies-button"
                onClick={handleToggleReplies}
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
            <ReplyItem 
              key={reply.id} 
              reply={reply} 
              getInitials={getInitials}
              formatTimeAgo={formatTimeAgo}
            />
          ))}
        </div>
      )}

      {/* Reply Input Box */}
      {replyingTo === comment.id && (
        <ReplyInputBox
          comment={comment}
          replyText={replyText}
          setReplyText={setReplyText}
          onPostReply={onPostReply}
          getInitials={getInitials}
          user={user}
        />
      )}
    </div>
  );
});

CommentItem.displayName = 'CommentItem';

// Memoized Reply component
const ReplyItem = memo(({ reply, getInitials, formatTimeAgo }) => {
  const MAX_REPLY_LENGTH = 150;
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongReply = reply.reply.length > MAX_REPLY_LENGTH;

  return (
    <div className="reply-item">
      <div className="reply-avatar">
        {getInitials(reply.user_fullname || reply.fullName || reply.username)}
      </div>
      <div className="reply-content">
        <div className="reply-header">
          <span className="reply-author">
            {reply.user_fullname || reply.fullName || reply.username}
          </span>
          <span className={`role-badge ${reply.user_role ? reply.user_role.toLowerCase().replace(' ', '-').replace('_', '-') : 'user'}`}>
            {reply.user_role || 'USER'}
          </span>
          <span className="reply-time">{formatTimeAgo(reply.created_at)}</span>
        </div>
        <div className="reply-text">
          {isLongReply && !isExpanded
            ? reply.reply.substring(0, MAX_REPLY_LENGTH) + '...'
            : reply.reply}
          {isLongReply && (
            <button
              className="see-more-btn"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'See less' : 'See more'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

ReplyItem.displayName = 'ReplyItem';

// Memoized Reply Input component
const ReplyInputBox = memo(({ comment, replyText, setReplyText, onPostReply, getInitials, user }) => {
  const handleSubmit = useCallback((e) => {
    onPostReply(e, comment.id);
  }, [onPostReply, comment.id]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  return (
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
          onKeyPress={handleKeyPress}
          autoFocus
        />
        <button
          className="comment-submit-btn"
          onClick={handleSubmit}
          disabled={!replyText.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );
});

ReplyInputBox.displayName = 'ReplyInputBox';

// Main modal component with React.memo
const CommentsModal = memo(({
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
  user,
  highlightUsername = null
}) => {
  // Early return for better performance
  if (!isOpen || !assignment) return null;

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onPostComment(e);
    }
  }, [onPostComment]);

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
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                  visibleReplies={visibleReplies}
                  toggleRepliesVisibility={toggleRepliesVisibility}
                  getInitials={getInitials}
                  formatTimeAgo={formatTimeAgo}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  onPostReply={onPostReply}
                  user={user}
                  highlightUsername={highlightUsername}
                />
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
                onKeyPress={handleKeyPress}
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
  );
});

CommentsModal.displayName = 'CommentsModal';

export default CommentsModal;
