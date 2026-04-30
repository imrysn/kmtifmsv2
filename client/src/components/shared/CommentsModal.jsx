import React, { memo, useCallback, useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import './CommentsModal.css';

// Renders text with @mention highlights — memoized outside components so it's stable
const renderTextWithMentions = (text) => {
  if (!text) return null;
  const mentionRegex = /(@[A-Za-z0-9_.]+)/g;
  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push(text.slice(lastIndex, match.index));
    segments.push(<span key={match.index} className="mention-highlight">{match[0]}</span>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push(text.slice(lastIndex));
  return segments.length > 0 ? segments : text;
};

const computeInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ─── Three-dot menu ───────────────────────────────────────────────────────────
const MoreMenu = memo(({ onEdit, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return; // let toggle handle it
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    // Close on any scroll anywhere so the fixed dropdown doesn't float away
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', onScroll, true); // capture phase catches modal scroll too
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const handleToggle = useCallback((e) => {
    e.stopPropagation();
    setOpen(prev => {
      if (!prev && btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setDropdownPos({ top: rect.bottom + 4, left: rect.right - 130 });
      }
      return !prev;
    });
  }, []);

  const handleEdit = useCallback(() => { setOpen(false); onEdit(); }, [onEdit]);
  const handleDelete = useCallback(() => { setOpen(false); onDelete(); }, [onDelete]);

  return (
    <div className="more-menu-wrapper">
      <button ref={btnRef} className="more-menu-btn" onClick={handleToggle} title="More options">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
      </button>
      {open && ReactDOM.createPortal(
        <div
          ref={ref}
          className="more-menu-dropdown"
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left }}
        >
          <button className="more-menu-item" onClick={handleEdit}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button className="more-menu-item more-menu-item--danger" onClick={handleDelete}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  );
});
MoreMenu.displayName = 'MoreMenu';

// ─── Inline edit input ────────────────────────────────────────────────────────
const EditInput = memo(({ initialText, onSave, onCancel }) => {
  const [text, setText] = useState(initialText);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(text); }
    if (e.key === 'Escape') onCancel();
  }, [text, onSave, onCancel]);

  return (
    <div className="edit-input-wrapper">
      <input
        ref={inputRef}
        className="edit-input"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="edit-input-actions">
        <button className="edit-save-btn" onClick={() => onSave(text)} disabled={!text.trim()}>Save</button>
        <button className="edit-cancel-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
});
EditInput.displayName = 'EditInput';

// ─── ReplyItem ────────────────────────────────────────────────────────────────
const ReplyItem = memo(({ reply, parentCommentId, assignmentId, onReplyToReply, onEditReply, onDeleteReply, currentUserId }) => {
  const MAX_REPLY_LENGTH = 150;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isLong = reply.reply.length > MAX_REPLY_LENGTH;
  const isOwner = useMemo(() => String(reply.user_id) === String(currentUserId), [reply.user_id, currentUserId]);

  const initials = useMemo(
    () => computeInitials(reply.user_fullname || reply.fullName || reply.username),
    [reply.user_fullname, reply.fullName, reply.username]
  );

  const displayName = useMemo(
    () => reply.user_fullname || reply.fullName || reply.username,
    [reply.user_fullname, reply.fullName, reply.username]
  );

  const roleCls = useMemo(
    () => `role-badge ${reply.user_role ? reply.user_role.toLowerCase().replace(/[\s_]/g, '-') : 'user'}`,
    [reply.user_role]
  );

  const renderedText = useMemo(() => {
    const content = isLong && !isExpanded ? reply.reply.substring(0, MAX_REPLY_LENGTH) + '...' : reply.reply;
    return renderTextWithMentions(content);
  }, [reply.reply, isLong, isExpanded]);

  const handleReply = useCallback(() => {
    if (onReplyToReply) onReplyToReply(parentCommentId, displayName);
  }, [displayName, onReplyToReply, parentCommentId]);

  const handleToggleExpand = useCallback(() => setIsExpanded(v => !v), []);

  const handleSaveEdit = useCallback((newText) => {
    onEditReply(assignmentId, parentCommentId, reply.id, newText);
    setIsEditing(false);
  }, [onEditReply, assignmentId, parentCommentId, reply.id]);

  const handleCancelEdit = useCallback(() => setIsEditing(false), []);
  const handleDelete = useCallback(() => onDeleteReply(assignmentId, parentCommentId, reply.id), [onDeleteReply, assignmentId, parentCommentId, reply.id]);

  return (
    <div className="reply-item">
      <div className="reply-avatar">{initials}</div>
      <div className="reply-content">
        {isEditing ? (
          <EditInput initialText={reply.reply} onSave={handleSaveEdit} onCancel={handleCancelEdit} />
        ) : (
          <>
            <div className="reply-bubble">
              <div className="reply-header">
                <span className="reply-author">{displayName}</span>
                <span className={roleCls}>{reply.user_role || 'USER'}</span>
                {isOwner && (
                  <div className="bubble-menu-wrap">
                    <MoreMenu onEdit={() => setIsEditing(true)} onDelete={handleDelete} />
                  </div>
                )}
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
              <span className="reply-time">{reply._timeAgo}{reply.updated_at && reply.updated_at !== reply.created_at ? ' · edited' : ''}</span>
              {onReplyToReply && <button className="reply-button" onClick={handleReply}>Reply</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
});
ReplyItem.displayName = 'ReplyItem';

// ─── ReplyInputBox ────────────────────────────────────────────────────────────
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
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
        <button className="comment-submit-btn" onClick={handleSubmit} disabled={!text.trim()}>➤</button>
      </div>
    </div>
  );
});
ReplyInputBox.displayName = 'ReplyInputBox';

// ─── CommentItem ──────────────────────────────────────────────────────────────
const CommentItem = memo(({
  comment,
  assignmentId,
  isReplying,
  mentionText,
  repliesVisible,
  onReply,
  onToggleReplies,
  onPostReply,
  onEditComment,
  onDeleteComment,
  onEditReply,
  onDeleteReply,
  userInitials,
  highlightUsername,
  currentUserId,
}) => {
  const MAX_LEN = 150;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isLong = comment.comment.length > MAX_LEN;
  const isOwner = useMemo(() => String(comment.user_id) === String(currentUserId), [comment.user_id, currentUserId]);

  const initials = useMemo(
    () => computeInitials(comment.user_fullname || comment.fullName || comment.username),
    [comment.user_fullname, comment.fullName, comment.username]
  );

  const displayName = useMemo(
    () => comment.user_fullname || comment.fullName || comment.username,
    [comment.user_fullname, comment.fullName, comment.username]
  );

  const roleCls = useMemo(
    () => `role-badge ${comment.user_role ? comment.user_role.toLowerCase().replace(/[\s_]/g, '-') : 'user'}`,
    [comment.user_role]
  );

  const isHighlighted = useMemo(
    () => !!(highlightUsername && (comment.username === highlightUsername || comment.user_fullname === highlightUsername)),
    [highlightUsername, comment.username, comment.user_fullname]
  );

  const threadCls = useMemo(
    () => isHighlighted ? 'comment-thread highlight-comment' : 'comment-thread',
    [isHighlighted]
  );

  const renderedText = useMemo(() => {
    const content = isLong && !isExpanded ? comment.comment.substring(0, MAX_LEN) + '...' : comment.comment;
    return renderTextWithMentions(content);
  }, [comment.comment, isLong, isExpanded]);

  const replyCount = useMemo(() => comment.replies?.length ?? 0, [comment.replies]);

  const handleReplyClick = useCallback(() => onReply(comment.id, displayName), [comment.id, displayName, onReply]);
  const handleToggleReplies = useCallback(() => onToggleReplies(comment.id), [comment.id, onToggleReplies]);
  const handleToggleExpand = useCallback(() => setIsExpanded(v => !v), []);

  const handleSaveEdit = useCallback((newText) => {
    onEditComment(assignmentId, comment.id, newText);
    setIsEditing(false);
  }, [onEditComment, assignmentId, comment.id]);

  const handleCancelEdit = useCallback(() => setIsEditing(false), []);
  const handleDelete = useCallback(() => onDeleteComment(assignmentId, comment.id), [onDeleteComment, assignmentId, comment.id]);

  return (
    <div className={threadCls} data-comment-id={comment.id}>
      <div className="comment-item">
        <div className="comment-avatar">{initials}</div>
        <div className="comment-content">
          {isEditing ? (
            <EditInput initialText={comment.comment} onSave={handleSaveEdit} onCancel={handleCancelEdit} />
          ) : (
            <>
              <div className="comment-bubble">
                <div className="comment-header">
                  <span className="comment-author">{displayName}</span>
                  <span className={roleCls}>{comment.user_role || 'USER'}</span>
                  {isOwner && (
                    <div className="bubble-menu-wrap">
                      <MoreMenu onEdit={() => setIsEditing(true)} onDelete={handleDelete} />
                    </div>
                  )}
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
                <span className="comment-time">
                  {comment._timeAgo}
                  {comment.updated_at && comment.updated_at !== comment.created_at ? ' · edited' : ''}
                </span>
                <button className="reply-button" onClick={handleReplyClick}>Reply</button>
                {replyCount > 0 && (
                  <button className="view-replies-button" onClick={handleToggleReplies}>
                    {repliesVisible ? 'Hide' : 'View'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {replyCount > 0 && repliesVisible && (
        <div className="replies-thread">
          {comment.replies.map(reply => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              parentCommentId={comment.id}
              assignmentId={assignmentId}
              onReplyToReply={onReply}
              onEditReply={onEditReply}
              onDeleteReply={onDeleteReply}
              usesMention={true}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

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
  onEditComment,
  onDeleteComment,
  onEditReply,
  onDeleteReply,
  visibleReplies,
  toggleRepliesVisibility,
  getInitials,
  formatTimeAgo,
  user,
  highlightUsername = null,
}) => {
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyMentionText, setReplyMentionText] = useState('');

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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onPostComment(e); }
  }, [onPostComment]);

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
                  assignmentId={assignment.id}
                  isReplying={replyingTo === comment.id}
                  mentionText={replyingTo === comment.id ? replyMentionText : ''}
                  repliesVisible={!!visibleReplies[comment.id]}
                  onReply={handleSetReplyingTo}
                  onToggleReplies={toggleRepliesVisibility}
                  onPostReply={handlePostReply}
                  onEditComment={onEditComment}
                  onDeleteComment={onDeleteComment}
                  onEditReply={onEditReply}
                  onDeleteReply={onDeleteReply}
                  userInitials={userInitials}
                  highlightUsername={highlightUsername}
                  currentUserId={user.id}
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
              <button className="comment-submit-btn" onClick={onPostComment} disabled={!newComment.trim()}>➤</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
CommentsModal.displayName = 'CommentsModal';

export default CommentsModal;
