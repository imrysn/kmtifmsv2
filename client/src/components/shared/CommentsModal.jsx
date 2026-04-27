import React, { memo, useCallback, useState, useEffect, useRef, useMemo } from 'react';
import './CommentsModal.css';

// Renders text with @mention highlights — memoized outside components so it's stable
const renderTextWithMentions = (text) => {
  if (!text) return null;
  const mentionRegex = /(@[A-Za-z0-9_.]+)/g;
  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }
    segments.push(
      <span key={match.index} className="mention-highlight">{match[0]}</span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push(text.slice(lastIndex));
  return segments.length > 0 ? segments : text;
};

// Pre-compute initials outside render — pure function, safe to call at module level
const computeInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ─── ReplyItem ────────────────────────────────────────────────────────────────
const ReplyItem = memo(({ reply, parentCommentId, onReplyToReply, usesMention }) => {
  const MAX_REPLY_LENGTH = 150;
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = reply.reply.length > MAX_REPLY_LENGTH;

  // Stable initials — only recompute when name changes
  const initials = useMemo(
    () => computeInitials(reply.user_fullname || reply.fullName || reply.username),
    [reply.user_fullname, reply.fullName, reply.username]
  );

  // Memoize display name and role class — avoid string ops every render
  const displayName = useMemo(
    () => reply.user_fullname || reply.fullName || reply.username,
    [reply.user_fullname, reply.fullName, reply.username]
  );

  const roleCls = useMemo(
    () => `role-badge ${reply.user_role
      ? reply.user_role.toLowerCase().replace(/[\s_]/g, '-')
      : 'user'}`,
    [reply.user_role]
  );

  // Memoized text so it doesn't re-parse on unrelated re-renders
  const renderedText = useMemo(() => {
    const content = isLong && !isExpanded
      ? reply.reply.substring(0, MAX_REPLY_LENGTH) + '...'
      : reply.reply;
    return renderTextWithMentions(content);
  }, [reply.reply, isLong, isExpanded]);

  const handleReply = useCallback(() => {
    if (usesMention) onReplyToReply(parentCommentId, displayName);
    else onReplyToReply(parentCommentId);
  }, [displayName, usesMention, onReplyToReply, parentCommentId]);

  const handleToggleExpand = useCallback(() => setIsExpanded(v => !v), []);

  return (
    <div className="reply-item">
      <div className="reply-avatar">{initials}</div>
      <div className="reply-content">
        <div className="reply-bubble">
          <div className="reply-header">
            <span className="reply-author">{displayName}</span>
            <span className={roleCls}>{reply.user_role || 'USER'}</span>
          </div>
          <div className="reply-text">
            {renderedText}
            {isLong && (
              <button className="see-more-btn" onClick={handleToggleExpand}>
                {isExpanded ? 'See less' : 'See more'}
              </button>
            )}
          </div>
        </div>
        <div className="reply-meta-row">
          <span className="reply-time">{reply._timeAgo}</span>
          {onReplyToReply && (
            <button className="reply-button" onClick={handleReply}>Reply</button>
          )}
        </div>
      </div>
    </div>
  );
});
ReplyItem.displayName = 'ReplyItem';

// ─── ReplyInputBox ────────────────────────────────────────────────────────────
// Owns its own text state — typing here never re-renders sibling comments
const ReplyInputBox = memo(({ comment, initialText, onPostReply, userInitials }) => {
  const [text, setText] = useState(initialText || '');
  const prevInitial = useRef(initialText);

  useEffect(() => {
    if (initialText !== prevInitial.current) {
      setText(initialText || '');
      prevInitial.current = initialText;
    }
  }, [initialText]);

  const handleSubmit = useCallback((e) => {
    onPostReply(e, comment.id, text, () => setText(''));
  }, [onPostReply, comment.id, text]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  const handleChange = useCallback((e) => setText(e.target.value), []);

  return (
    <div className="reply-input-box">
      <div className="reply-avatar">{userInitials}</div>
      <div className="comment-input-wrapper">
        <input
          type="text"
          className="comment-input"
          placeholder="Write a reply..."
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button
          className="comment-submit-btn"
          onClick={handleSubmit}
          disabled={!text.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );
});
ReplyInputBox.displayName = 'ReplyInputBox';

// ─── CommentItem ──────────────────────────────────────────────────────────────
const CommentItem = memo(({
  comment,
  isReplying,        // boolean — only true for the one comment being replied to
  mentionText,       // string — only non-empty for the one comment being replied to
  repliesVisible,    // boolean — only for this comment's replies
  onReply,
  onToggleReplies,   // (commentId) => void — stable ref from parent
  onPostReply,
  userInitials,
  highlightUsername,
}) => {
  const MAX_LEN = 150;
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = comment.comment.length > MAX_LEN;

  const initials = useMemo(
    () => computeInitials(comment.user_fullname || comment.fullName || comment.username),
    [comment.user_fullname, comment.fullName, comment.username]
  );

  // Memoize display name, role class, and highlight check — all stable per comment
  const displayName = useMemo(
    () => comment.user_fullname || comment.fullName || comment.username,
    [comment.user_fullname, comment.fullName, comment.username]
  );

  const roleCls = useMemo(
    () => `role-badge ${comment.user_role
      ? comment.user_role.toLowerCase().replace(/[\s_]/g, '-')
      : 'user'}`,
    [comment.user_role]
  );

  const isHighlighted = useMemo(
    () => !!(highlightUsername &&
      (comment.username === highlightUsername || comment.user_fullname === highlightUsername)),
    [highlightUsername, comment.username, comment.user_fullname]
  );

  const threadCls = useMemo(
    () => isHighlighted ? 'comment-thread highlight-comment' : 'comment-thread',
    [isHighlighted]
  );

  // Memoize rendered text — only re-parse when comment text or expand state changes
  const renderedText = useMemo(() => {
    const content = isLong && !isExpanded
      ? comment.comment.substring(0, MAX_LEN) + '...'
      : comment.comment;
    return renderTextWithMentions(content);
  }, [comment.comment, isLong, isExpanded]);

  const replyCount = useMemo(() => comment.replies?.length ?? 0, [comment.replies]);

  const handleReplyClick = useCallback(() => {
    onReply(comment.id, displayName);
  }, [comment.id, displayName, onReply]);

  const handleToggleReplies = useCallback(() => {
    onToggleReplies(comment.id);
  }, [comment.id, onToggleReplies]);

  const handleToggleExpand = useCallback(() => setIsExpanded(v => !v), []);

  return (
    <div
      className={threadCls}
      data-comment-id={comment.id}
    >
      <div className="comment-item">
        <div className="comment-avatar">{initials}</div>
        <div className="comment-content">
          <div className="comment-bubble">
            <div className="comment-header">
              <span className="comment-author">{displayName}</span>
              <span className={roleCls}>{comment.user_role || 'USER'}</span>
            </div>
            <div className="comment-text">
              {renderedText}
              {isLong && (
                <button className="see-more-btn" onClick={handleToggleExpand}>
                  {isExpanded ? 'See less' : 'See more'}
                </button>
              )}
            </div>
          </div>
          <div className="comment-actions">
              <span className="comment-time">{comment._timeAgo}</span>
              <button className="reply-button" onClick={handleReplyClick}>Reply</button>
            {replyCount > 0 && (
              <button className="view-replies-button" onClick={handleToggleReplies}>
                {repliesVisible ? 'Hide' : 'View'} {replyCount}{' '}
                {replyCount === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies — only rendered when visible */}
      {replyCount > 0 && repliesVisible && (
        <div className="replies-thread">
          {comment.replies.map(reply => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              parentCommentId={comment.id}
              onReplyToReply={onReply}
              usesMention={true}
            />
          ))}
        </div>
      )}

      {/* Reply input — only mounted for the one active comment */}
      {isReplying && (
        <ReplyInputBox
          comment={comment}
          initialText={mentionText}
          onPostReply={onPostReply}
          userInitials={userInitials}
        />
      )}
    </div>
  );
});
CommentItem.displayName = 'CommentItem';

// ─── CommentsModal ────────────────────────────────────────────────────────────
const CommentsModal = memo(({
  isOpen,
  onClose,
  assignment,
  comments,
  loadingComments,
  newComment,
  setNewComment,
  onPostComment,
  onPostReply,
  visibleReplies,
  toggleRepliesVisibility,
  getInitials,
  formatTimeAgo,
  user,
  highlightUsername = null,
}) => {
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyMentionText, setReplyMentionText] = useState('');

  // Pre-stamp each comment/reply with its formatted time so formatTimeAgo
  // is NOT called inside every CommentItem render
  const stampedComments = useMemo(() => {
    if (!comments?.length) return comments;
    return comments.map(c => ({
      ...c,
      _timeAgo: formatTimeAgo(c.created_at),
      replies: c.replies?.map(r => ({
        ...r,
        _timeAgo: formatTimeAgo(r.created_at),
      })),
    }));
  }, [comments, formatTimeAgo]);

  const userInitials = useMemo(
    () => computeInitials(user.username || user.fullName),
    [user.username, user.fullName]
  );

  const handleSetReplyingTo = useCallback((commentId, authorName) => {
    setReplyingTo(commentId);
    const token = authorName ? authorName.replace(/\s+/g, '_') : null;
    setReplyMentionText(token ? `@${token} ` : '');
  }, []);

  const handlePostReply = useCallback((e, commentId, replyText, onInputClear) => {
    onPostReply(e, commentId, replyText, () => {
      setReplyingTo(null);
      setReplyMentionText('');
      if (onInputClear) onInputClear();
    });
  }, [onPostReply]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onPostComment(e);
    }
  }, [onPostComment]);

  // Stable stopPropagation handler — prevents new function allocation on every render
  const handleModalClick = useCallback((e) => e.stopPropagation(), []);

  const handleCommentChange = useCallback((e) => setNewComment(e.target.value), [setNewComment]);

  if (!isOpen || !assignment) return null;

  return (
    <div className="comments-modal-overlay" onClick={onClose}>
      <div className="comments-modal" onClick={handleModalClick}>
        <div className="comments-modal-header">
          <h3>Comments - {assignment.title}</h3>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        <div className="comments-modal-body">
          {loadingComments ? (
            <div className="loading-comments">
              <div className="spinner" />
              <p>Loading comments...</p>
            </div>
          ) : !stampedComments?.length ? (
            <div className="no-comments">
              <p>💬 No comments yet. Be the first to comment!</p>
            </div>
          ) : (
            <div className="comments-list">
              {stampedComments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  isReplying={replyingTo === comment.id}
                  mentionText={replyingTo === comment.id ? replyMentionText : ''}
                  repliesVisible={!!visibleReplies[comment.id]}
                  onReply={handleSetReplyingTo}
                  onToggleReplies={toggleRepliesVisibility}
                  onPostReply={handlePostReply}
                  userInitials={userInitials}
                  highlightUsername={highlightUsername}
                />
              ))}
            </div>
          )}
        </div>

        <div className="comments-modal-footer">
          <div className="add-comment">
            <div className="comment-avatar">{userInitials}</div>
            <div className="comment-input-wrapper">
              <input
                type="text"
                className="comment-input"
                placeholder="Write a comment..."
                value={newComment}
                onChange={handleCommentChange}
                onKeyDown={handleKeyDown}
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
