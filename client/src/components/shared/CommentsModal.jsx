import React, { memo, useCallback, useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import './CommentsModal.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Renders text with @mention highlights
const renderTextWithMentions = (text, users = []) => {
  if (!text) return null;
  
  // Build a dynamic regex based on known full names to support spaces
  const escapedNames = users
    .map(u => u.fullName || u.username)
    .filter(Boolean)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s\\u00A0]+')) // Match any whitespace
    .sort((a, b) => b.length - a.length); // Match longest names first

  const namesPattern = escapedNames.length > 0 ? `|${escapedNames.join('|')}` : '';
  
  // Combine: @Everyone | @Full Name | @Username | @DefaultFallback
  const mentionRegex = new RegExp(`(@(?:everyone|everyone_in_thread${namesPattern}|[A-Za-z0-9_.\u00C0-\u017F\u3040-\u30FF\u4E00-\u9FFF]+))`, 'g');
  
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

// Role badge colour map
const ROLE_BADGE_STYLE = {
  ADMIN:       { background: '#fee2e2', color: '#dc2626' },
  TEAM_LEADER: { background: '#dbeafe', color: '#1877f2' },
  USER:        { background: '#d3f1d8', color: '#1a7f37' },
};

// ─── @Mention Picker Hook ─────────────────────────────────────────────────────
function useMentionInput({ value, onChange, mentionableUsers, caretPosRef }) {
  const [picker, setPicker] = useState({ open: false, query: '', index: -1 });
  const [atPos, setAtPos] = useState(-1);

  const filtered = useMemo(() => {
    if (!picker.open || !mentionableUsers?.length) return [];
    const q = picker.query.toLowerCase();
    
    const users = mentionableUsers
      .filter(u =>
        u.fullName?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
      )
      .slice(0, 8);

    // Add @everyone option if query matches or is empty
    if ('everyone'.includes(q) || q === '') {
      return [{ id: 'everyone', username: 'everyone', fullName: 'Everyone', role: 'Mention all', isSpecial: true }, ...users];
    }
    return users;
  }, [picker.open, picker.query, mentionableUsers]);

  const handleKeyChange = useCallback((e, inputEl) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    onChange(val);

    // Detect if there's an active @... segment before cursor
    const before = val.slice(0, cursor);
    const atMatch = before.match(/@([A-Za-z0-9_.\u00C0-\u017F\u3040-\u30FF\u4E00-\u9FFF]*)$/);
    if (atMatch) {
      setAtPos(cursor - atMatch[0].length);
      setPicker({ open: true, query: atMatch[1], index: 0 });
    } else {
      setPicker(p => ({ ...p, open: false }));
    }
  }, [onChange]);

  const selectUser = useCallback((u) => {
    const mentionText = u.isSpecial ? 'everyone' : (u.fullName || u.username);
    const mention = `@${mentionText.replace(/\s+/g, '_')} `;
    const before = value.slice(0, atPos);
    const afterAt = value.slice(atPos);
    const afterMention = afterAt.replace(/^@[A-Za-z0-9_.]*/, '');
    const newVal = before + mention + afterMention;
    // Tell the sync effect exactly where to place the cursor (after the mention + space)
    if (caretPosRef) caretPosRef.current = (before + mention).length;
    onChange(newVal);
    setPicker(p => ({ ...p, open: false }));
  }, [value, atPos, onChange, caretPosRef]);

  const handleKeyDown = useCallback((e) => {
    if (!picker.open || !filtered.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPicker(p => ({ ...p, index: Math.min(p.index + 1, filtered.length - 1) }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPicker(p => ({ ...p, index: Math.max(p.index - 1, 0) }));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filtered[picker.index]) {
        e.preventDefault();
        selectUser(filtered[picker.index]);
      }
    } else if (e.key === 'Escape') {
      setPicker(p => ({ ...p, open: false }));
    }
  }, [picker, filtered, selectUser]);

  return { picker, filtered, handleKeyChange, handleKeyDown, selectUser, setAtPos, setPicker };
}

// ─── helpers for contentEditable caret manipulation ─────────────────────────
function getCaretOffset(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
  return range.toString().length;
}

function setCaretOffset(el, offset) {
  try {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node;
    while ((node = walk.nextNode())) {
      if (remaining <= node.length) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(node, remaining);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= node.length;
    }
    // fallback: move to end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  } catch (_) {}
}

// Build innerHTML with highlighted @mentions (visible colored text, normal caret)
function buildHTML(text, users = []) {
  if (!text) return '';
  
  const escapedNames = users
    .map(u => u.fullName || u.username)
    .filter(Boolean)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s\\u00A0]+'))
    .sort((a, b) => b.length - a.length);

  const namesPattern = escapedNames.length > 0 ? `|${escapedNames.join('|')}` : '';
  const mentionRegex = new RegExp(`(@(?:everyone|everyone_in_thread${namesPattern}|[A-Za-z0-9_.\u00C0-\u017F\u3040-\u30FF\u4E00-\u9FFF]+))`, 'g');

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(mentionRegex, '<span class="input-mention-highlight">$1</span>');
}

// ─── MentionInput — contentEditable with live @mention highlighting ──────────
const MentionInput = memo((
  { value, onChange, onSubmit, placeholder, mentionableUsers, autoFocus },
) => {
  const editorRef = useRef(null);
  const isComposingRef = useRef(false);
  const caretPosRef = useRef(-1); // -1 = keep pos, >=0 = force this offset after update
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });

  const { picker, filtered, handleKeyDown, selectUser, setAtPos, setPicker } =
    useMentionInput({ value, onChange, mentionableUsers, caretPosRef });

  // ── Sync external value → DOM innerHTML (re-renders highlights without caret jump) ──
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    // Save caret before rewriting
    const savedOffset = caretPosRef.current >= 0
      ? caretPosRef.current
      : (document.activeElement === el ? getCaretOffset(el) : -1);
    caretPosRef.current = -1;

    const newHTML = buildHTML(value, mentionableUsers);
    // Only rewrite if content actually changed to avoid unnecessary caret resets
    if (el.innerHTML !== newHTML) {
      el.innerHTML = newHTML || '';
      // Restore caret
      if (savedOffset >= 0) {
        setCaretOffset(el, savedOffset);
      }
    }
  }, [value, mentionableUsers]);

  useEffect(() => {
    if (autoFocus && editorRef.current) editorRef.current.focus();
  }, [autoFocus]);

  // Position picker above the editor
  useEffect(() => {
    if (picker.open && editorRef.current) {
      const rect = editorRef.current.getBoundingClientRect();
      setPickerPos({ top: rect.top - 8, left: rect.left });
    }
  }, [picker.open]);

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return;
    const el = editorRef.current;
    if (!el) return;
    // Read plain text from DOM (spans stripped)
    const text = el.innerText.replace(/\n$/, '');
    onChange(text);

    // Detect @mention trigger
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const offset = getCaretOffset(el);
    const before = text.slice(0, offset);
    const atMatch = before.match(/@([A-Za-z0-9_.\u00C0-\u017F\u3040-\u30FF\u4E00-\u9FFF]*)$/);
    if (atMatch) {
      setAtPos(offset - atMatch[0].length);
      setPicker({ open: true, query: atMatch[1], index: 0 });
    } else {
      setPicker(p => ({ ...p, open: false }));
    }
  }, [onChange, setAtPos, setPicker]);

  const handleKeyDownEditor = useCallback((e) => {
    handleKeyDown(e);
    if (!picker.open && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.(e);
    }
  }, [handleKeyDown, picker.open, onSubmit]);

  return (
    <div className="mention-input-container">
      <div
        ref={editorRef}
        className={`mention-input-editor${!value ? ' is-empty' : ''}`}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDownEditor}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          handleInput();
        }}
        spellCheck={false}
      />
      {picker.open && filtered.length > 0 && ReactDOM.createPortal(
        <div
          className="mention-picker"
          style={{ 
            position: 'fixed', 
            top: pickerPos.top - Math.min(280, (filtered.length * 54) + 12), 
            left: pickerPos.left 
          }}
        >
          {filtered.map((u, i) => {
            const role = u.role?.toUpperCase().replace(/[\s_]/g, '_');
            const badgeStyle = ROLE_BADGE_STYLE[role] || ROLE_BADGE_STYLE.USER;
            const isEveryone = u.id === 'everyone';
            
            return (
              <div
                key={u.id}
                className={`mention-picker-item${i === picker.index ? ' mention-picker-item--active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); selectUser(u); }}
              >
                <div className={`mention-picker-avatar ${isEveryone ? 'everyone' : ''}`}>
                  {isEveryone ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                    </svg>
                  ) : computeInitials(u.fullName || u.username)}
                </div>
                <div className="mention-picker-info">
                  <span className="mention-picker-name">{isEveryone ? '@everyone' : (u.fullName || u.username)}</span>
                  <span className="mention-picker-subtitle">
                    {isEveryone ? 'Notify everyone in this thread' : `${u.role || 'Member'} ${u.team ? `· ${u.team}` : ''}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
});
MentionInput.displayName = 'MentionInput';

// ─── Three-dot menu ───────────────────────────────────────────────────────────
const MoreMenu = memo(({ onEdit, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', onScroll, true);
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
        <div ref={ref} className="more-menu-dropdown" style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left }}>
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
      <input ref={inputRef} className="edit-input" value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown} />
      <div className="edit-input-actions">
        <button className="edit-save-btn" onClick={() => onSave(text)} disabled={!text.trim()}>Save</button>
        <button className="edit-cancel-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
});
EditInput.displayName = 'EditInput';

// ─── ReplyItem ────────────────────────────────────────────────────────────────
const ReplyItem = memo(({ reply, parentCommentId, assignmentId, onReplyToReply, onEditReply, onDeleteReply, currentUserId, mentionableUsers }) => {
  const MAX_REPLY_LENGTH = 150;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isLong = reply.reply.length > MAX_REPLY_LENGTH;
  const isOwner = useMemo(() => String(reply.user_id) === String(currentUserId), [reply.user_id, currentUserId]);
  const initials = useMemo(() => computeInitials(reply.user_fullname || reply.fullName || reply.username), [reply.user_fullname, reply.fullName, reply.username]);
  const displayName = useMemo(() => reply.user_fullname || reply.fullName || reply.username, [reply.user_fullname, reply.fullName, reply.username]);
  const roleCls = useMemo(() => `role-badge ${reply.user_role ? reply.user_role.toLowerCase().replace(/[\s_]/g, '-') : 'user'}`, [reply.user_role]);
  const renderedText = useMemo(() => {
    const content = isLong && !isExpanded ? reply.reply.substring(0, MAX_REPLY_LENGTH) + '...' : reply.reply;
    return renderTextWithMentions(content, mentionableUsers);
  }, [reply.reply, isLong, isExpanded, mentionableUsers]);
  const handleReply = useCallback(() => { if (onReplyToReply) onReplyToReply(parentCommentId, displayName); }, [displayName, onReplyToReply, parentCommentId]);
  const handleSaveEdit = useCallback((newText) => { onEditReply(assignmentId, parentCommentId, reply.id, newText); setIsEditing(false); }, [onEditReply, assignmentId, parentCommentId, reply.id]);

  return (
    <div className="reply-item">
      <div className="reply-avatar">{initials}</div>
      <div className="reply-content">
        {isEditing ? (
          <EditInput initialText={reply.reply} onSave={handleSaveEdit} onCancel={() => setIsEditing(false)} />
        ) : (
          <>
            <div className="reply-bubble">
              <div className="reply-header">
                <span className="reply-author">{displayName}</span>
                <span className={roleCls}>{reply.user_role || 'USER'}</span>
                {isOwner && <div className="bubble-menu-wrap"><MoreMenu onEdit={() => setIsEditing(true)} onDelete={() => onDeleteReply(assignmentId, parentCommentId, reply.id)} /></div>}
              </div>
              <div className="reply-text">
                {renderedText}
                {isLong && <button className="see-more-btn" onClick={() => setIsExpanded(v => !v)}>{isExpanded ? 'See less' : 'See more'}</button>}
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
const ReplyInputBox = memo(({ comment, initialText, onPostReply, userInitials, mentionableUsers }) => {
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

  return (
    <div className="reply-input-box">
      <div className="reply-avatar">{userInitials}</div>
      <div className="comment-input-wrapper">
        <MentionInput
          value={text}
          onChange={setText}
          onSubmit={handleSubmit}
          placeholder="Write a reply... (@ to mention)"
          mentionableUsers={mentionableUsers}
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
  comment, assignmentId, isReplying, mentionText, repliesVisible,
  onReply, onToggleReplies, onPostReply, onEditComment, onDeleteComment,
  onEditReply, onDeleteReply, userInitials, highlightUsername, currentUserId, mentionableUsers,
}) => {
  const MAX_LEN = 150;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isLong = comment.comment.length > MAX_LEN;
  const isOwner = useMemo(() => String(comment.user_id) === String(currentUserId), [comment.user_id, currentUserId]);
  const initials = useMemo(() => computeInitials(comment.user_fullname || comment.fullName || comment.username), [comment.user_fullname, comment.fullName, comment.username]);
  const displayName = useMemo(() => comment.user_fullname || comment.fullName || comment.username, [comment.user_fullname, comment.fullName, comment.username]);
  const roleCls = useMemo(() => `role-badge ${comment.user_role ? comment.user_role.toLowerCase().replace(/[\s_]/g, '-') : 'user'}`, [comment.user_role]);
  const isHighlighted = useMemo(() => !!(highlightUsername && (comment.username === highlightUsername || comment.user_fullname === highlightUsername)), [highlightUsername, comment.username, comment.user_fullname]);
  const renderedText = useMemo(() => {
    const content = isLong && !isExpanded ? comment.comment.substring(0, MAX_LEN) + '...' : comment.comment;
    return renderTextWithMentions(content, mentionableUsers);
  }, [comment.comment, isLong, isExpanded, mentionableUsers]);
  const replyCount = useMemo(() => comment.replies?.length ?? 0, [comment.replies]);
  const handleReplyClick = useCallback(() => onReply(comment.id, displayName), [comment.id, displayName, onReply]);
  const handleToggleReplies = useCallback(() => onToggleReplies(comment.id), [comment.id, onToggleReplies]);
  const handleSaveEdit = useCallback((newText) => { onEditComment(assignmentId, comment.id, newText); setIsEditing(false); }, [onEditComment, assignmentId, comment.id]);

  return (
    <div className={isHighlighted ? 'comment-thread highlight-comment' : 'comment-thread'} data-comment-id={comment.id}>
      <div className="comment-item">
        <div className="comment-avatar">{initials}</div>
        <div className="comment-content">
          {isEditing ? (
            <EditInput initialText={comment.comment} onSave={handleSaveEdit} onCancel={() => setIsEditing(false)} />
          ) : (
            <>
              <div className="comment-bubble">
                <div className="comment-header">
                  <span className="comment-author">{displayName}</span>
                  <span className={roleCls}>{comment.user_role || 'USER'}</span>
                  {isOwner && <div className="bubble-menu-wrap"><MoreMenu onEdit={() => setIsEditing(true)} onDelete={() => onDeleteComment(assignmentId, comment.id)} /></div>}
                </div>
                <div className="comment-text">
                  {renderedText}
                  {isLong && <button className="see-more-btn" onClick={() => setIsExpanded(v => !v)}>{isExpanded ? 'See less' : 'See more'}</button>}
                </div>
              </div>
              <div className="comment-actions">
                <span className="comment-time">{comment._timeAgo}{comment.updated_at && comment.updated_at !== comment.created_at ? ' · edited' : ''}</span>
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
              currentUserId={currentUserId}
              mentionableUsers={mentionableUsers}
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
          mentionableUsers={mentionableUsers}
        />
      )}
    </div>
  );
});
CommentItem.displayName = 'CommentItem';

// ─── CommentsModal ────────────────────────────────────────────────────────────
const CommentsModal = memo(({
  isOpen, onClose, assignment, comments, loadingComments,
  newComment, setNewComment, onPostComment, onPostReply,
  onEditComment, onDeleteComment, onEditReply, onDeleteReply,
  visibleReplies, toggleRepliesVisibility,
  getInitials, formatTimeAgo, user, highlightUsername = null,
}) => {
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyMentionText, setReplyMentionText] = useState('');
  const [mentionableUsers, setMentionableUsers] = useState([]);

  // Fetch mentionable users every time the modal opens (ensures fresh list after server fix)
  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE_URL}/api/users/mentionable`)
      .then(r => r.json())
      .then(d => { if (d.success) setMentionableUsers(d.users || []); })
      .catch(() => {});
  }, [isOpen]);

  // Lock background scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevBody = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const mainContent = document.querySelector('.main-content');
    const prevMain = mainContent ? mainContent.style.overflow : null;
    if (mainContent) mainContent.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      if (mainContent && prevMain !== null) mainContent.style.overflow = prevMain;
    };
  }, [isOpen]);

  const stampedComments = useMemo(() => {
    if (!comments?.length) return comments;
    return comments.map(c => ({
      ...c,
      _timeAgo: formatTimeAgo(c.created_at),
      replies: c.replies?.map(r => ({ ...r, _timeAgo: formatTimeAgo(r.created_at) })),
    }));
  }, [comments, formatTimeAgo]);

  const userInitials = useMemo(() => computeInitials(user.username || user.fullName), [user.username, user.fullName]);

  const handleSetReplyingTo = useCallback((commentId, authorName) => {
    setReplyingTo(prev => {
      if (prev === commentId) return null; // toggle off if already open
      return commentId;
    });
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

  const handleModalClick = useCallback((e) => e.stopPropagation(), []);

  if (!isOpen || !assignment) return null;

  return (
    <div className="comments-modal-overlay">
      <div className="comments-modal" onClick={handleModalClick}>
        <div className="comments-modal-header">
          <h3>Comments - {assignment.title}</h3>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        <div className="comments-modal-body">
          {loadingComments ? (
            <div className="loading-comments"><div className="spinner" /><p>Loading comments...</p></div>
          ) : !stampedComments?.length ? (
            <div className="no-comments"><p>💬 No comments yet. Be the first to comment!</p></div>
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
                  mentionableUsers={mentionableUsers}
                />
              ))}
            </div>
          )}
        </div>

        <div className="comments-modal-footer">
          <div className="add-comment">
            <div className="comment-avatar">{userInitials}</div>
            <div className="comment-input-wrapper">
              <MentionInput
                value={newComment}
                onChange={setNewComment}
                onSubmit={onPostComment}
                placeholder="Write a comment... (@ to mention)"
                mentionableUsers={mentionableUsers}
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
