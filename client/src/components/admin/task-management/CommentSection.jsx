import React, { memo } from 'react'
import { getInitials, formatTimeAgo } from '../../../utils/adminUtils'

const CommentSection = memo(({
    comments = [],
    loadingComments,
    newComment,
    setNewComment,
    handlePostComment,
    handleCommentKeyDown,
    replyingTo,
    setReplyingTo,
    replyText,
    setReplyText,
    handlePostReply,
    handleReplyKeyDown,
    visibleReplies,
    toggleRepliesVisibility,
    user
}) => {
    return (
        <div className="admin-discussions">
            <div className="discussion-header">
                <h4>Task Discussions</h4>
            </div>

            <div className="comments-list">
                {loadingComments ? (
                    <div className="loading-spinner">Loading comments...</div>
                ) : comments.length === 0 ? (
                    <div className="no-comments">No discussions yet. Start a conversation.</div>
                ) : (
                    comments.map(comment => (
                        <div
                            key={comment.id}
                            className={`comment-item ${comment.id.toString().startsWith('temp-') ? 'optimistic' : ''}`}
                            data-comment-id={comment.id}
                        >
                            <div className="comment-avatar">
                                {getInitials(comment.user_fullname || comment.username)}
                            </div>
                            <div className="comment-main">
                                <div className="comment-header">
                                    <span className="comment-user">{comment.user_fullname || comment.username}</span>
                                    <span className={`role-badge ${comment.user_role === 'admin' ? 'admin' : 'team-leader'}`}>
                                        {(comment.user_role || 'member').toUpperCase()}
                                    </span>
                                    <span className="comment-date">{formatTimeAgo(comment.created_at)}</span>
                                </div>
                                <div className="comment-text">{comment.comment}</div>
                                <div className="comment-actions">
                                    <button
                                        className="reply-btn"
                                        onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                    >
                                        Reply
                                    </button>
                                    {comment.replies && comment.replies.length > 0 && (
                                        <button
                                            className="view-replies-btn"
                                            onClick={() => toggleRepliesVisibility(comment.id)}
                                        >
                                            {visibleReplies[comment.id] ? 'Hide Replies' : `View ${comment.replies.length} ${comment.replies.length === 1 ? 'Reply' : 'Replies'}`}
                                        </button>
                                    )}
                                </div>

                                {/* Reply Input */}
                                {replyingTo === comment.id && (
                                    <div className="reply-input-wrapper">
                                        <textarea
                                            placeholder="Write a reply..."
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            onKeyDown={(e) => handleReplyKeyDown(e, comment.id)}
                                            autoFocus
                                        />
                                        <div className="reply-actions">
                                            <button className="cancel-btn" onClick={() => setReplyingTo(null)}>Cancel</button>
                                            <button
                                                className="send-btn"
                                                disabled={!replyText.trim()}
                                                onClick={(e) => handlePostReply(e, comment.id)}
                                            >
                                                Reply
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Replies List */}
                                {visibleReplies[comment.id] && comment.replies && (
                                    <div className="replies-list">
                                        {comment.replies.map(reply => (
                                            <div
                                                key={reply.id}
                                                className={`reply-item ${reply.id.toString().startsWith('temp-') ? 'optimistic' : ''}`}
                                            >
                                                <div className="reply-avatar">
                                                    {getInitials(reply.user_fullname || reply.username)}
                                                </div>
                                                <div className="reply-main">
                                                    <div className="reply-header">
                                                        <span className="reply-user">{reply.user_fullname || reply.username}</span>
                                                        <span className={`role-badge ${reply.user_role === 'admin' ? 'admin' : 'team-leader'}`}>
                                                            {(reply.user_role || 'member').toUpperCase()}
                                                        </span>
                                                        <span className="reply-date">{formatTimeAgo(reply.created_at)}</span>
                                                    </div>
                                                    <div className="reply-text">{reply.reply}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* New Comment Input */}
            <div className="new-comment-wrapper">
                <textarea
                    placeholder="Share your thoughts or instructions..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={handleCommentKeyDown}
                />
                <div className="comment-footer">
                    <span className="shortcut-hint">Press Enter to post, Shift+Enter for new line</span>
                    <button
                        className="post-btn"
                        disabled={!newComment.trim()}
                        onClick={handlePostComment}
                    >
                        Post Comment
                    </button>
                </div>
            </div>
        </div>
    )
})

export default CommentSection
