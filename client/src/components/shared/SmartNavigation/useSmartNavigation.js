/**
 * Smart Navigation - Custom Hook
 * 
 * Provides smart navigation functionality including:
 * - Auto-opening comment modals
 * - Auto-expanding reply threads
 * - Highlighting items (assignments/files)
 * - Cascading file highlights
 * - Automatic cleanup
 * 
 * Extracted from Team Leader implementation for reuse across all dashboards.
 */

import { useEffect, useRef } from 'react';

/**
 * Smart navigation hook for handling notification-driven navigation
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.role - User role ('admin' | 'teamleader' | 'user')
 * @param {Array} config.items - Array of items (assignments or files)
 * @param {number} config.highlightedItemId - ID of item to highlight
 * @param {number} config.highlightedFileId - ID of file to highlight (for cascading)
 * @param {Object} config.notificationContext - Context for comment modal
 * @param {Function} config.onClearHighlight - Callback to clear item highlight
 * @param {Function} config.onClearFileHighlight - Callback to clear file highlight
 * @param {Function} config.onClearNotificationContext - Callback to clear notification context
 * @param {Function} config.openCommentsModal - Function to open comments modal
 * @param {Function} config.setVisibleReplies - Function to set visible replies
 * @param {boolean} config.showCommentsModal - Whether comments modal is open
 * @param {Object} config.selectedItem - Currently selected item
 * @param {Array} config.comments - Array of comments
 * @returns {Object} { shouldExpandRepliesRef }
 */
export function useSmartNavigation({
    role,
    items = [],
    highlightedItemId,
    highlightedFileId,
    notificationContext,
    onClearHighlight,
    onClearFileHighlight,
    onClearNotificationContext,
    openCommentsModal,
    setVisibleReplies,
    showCommentsModal,
    selectedItem,
    comments = []
}) {
    // Ref to track if we should expand replies
    const shouldExpandRepliesRef = useRef(false);

    // CSS class prefix based on role
    const CLASS_PREFIX = {
        admin: 'admin',
        teamleader: 'tl',
        user: 'user'
    };
    const prefix = CLASS_PREFIX[role] || 'sn';

    // ID prefix for DOM elements
    const ID_PREFIX = {
        admin: 'admin-assignment',
        teamleader: 'tl-assignment',
        user: 'user-assignment'
    };
    const idPrefix = ID_PREFIX[role] || 'assignment';

    // EFFECT 1: Auto-open comments modal with reply expansion
    useEffect(() => {
        if (notificationContext && items.length > 0) {
            const item = items.find(i => i.id === notificationContext.assignmentId);

            if (item) {
                // Store expand flag for reply notifications
                if (notificationContext.expandAllReplies) {
                    shouldExpandRepliesRef.current = true;
                }

                // Open comments modal
                if (openCommentsModal) {
                    openCommentsModal(item);
                }

                // Clear context after opening
                setTimeout(() => {
                    if (onClearNotificationContext) {
                        onClearNotificationContext();
                    }
                }, 100);
            }
        }
    }, [notificationContext, items, openCommentsModal, onClearNotificationContext]);

    // EFFECT 2: Auto-expand replies when modal opens
    useEffect(() => {
        if (showCommentsModal && selectedItem && shouldExpandRepliesRef.current) {
            setTimeout(() => {
                if (comments.length > 0 && setVisibleReplies) {
                    // Expand all comments with replies
                    const expandState = {};
                    let firstCommentWithReplies = null;

                    comments.forEach(comment => {
                        if (comment.replies && comment.replies.length > 0) {
                            expandState[comment.id] = true;
                            if (!firstCommentWithReplies) {
                                firstCommentWithReplies = comment.id;
                            }
                        }
                    });

                    // Apply expansion
                    setVisibleReplies(prev => ({ ...prev, ...expandState }));

                    // Scroll to first comment with replies
                    if (firstCommentWithReplies) {
                        setTimeout(() => {
                            const commentElement = document.querySelector(
                                `[data-comment-id="${firstCommentWithReplies}"]`
                            );
                            if (commentElement) {
                                commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }, 400);
                    }
                }

                // Reset flag
                shouldExpandRepliesRef.current = false;
            }, 500);
        }
    }, [showCommentsModal, selectedItem, comments, setVisibleReplies]);

    // EFFECT 3: Highlight item (assignment/file)
    useEffect(() => {
        if (highlightedItemId && items.length > 0) {
            setTimeout(() => {
                const element = document.getElementById(`${idPrefix}-${highlightedItemId}`);
                if (element) {
                    // Scroll to item
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Add highlight effect
                    element.classList.add(`${prefix}-assignment-highlighted`);

                    // Remove highlight after 1.5s
                    setTimeout(() => {
                        element.classList.remove(`${prefix}-assignment-highlighted`);
                        if (onClearHighlight) {
                            onClearHighlight();
                        }
                    }, 1500);
                }
            }, 300);
        }
    }, [highlightedItemId, items, onClearHighlight, prefix, idPrefix]);

    // EFFECT 4: Highlight file within item (cascading effect)
    useEffect(() => {
        if (highlightedFileId && highlightedItemId && items.length > 0) {
            // Wait 1 second for item to be highlighted first
            setTimeout(() => {
                const fileElement = document.querySelector(`[data-file-id="${highlightedFileId}"]`);
                if (fileElement) {
                    // Scroll to file within item
                    fileElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Add file highlight
                    fileElement.classList.add(`${prefix}-assignment-file-highlighted`);

                    // Remove after 1.5s
                    setTimeout(() => {
                        fileElement.classList.remove(`${prefix}-assignment-file-highlighted`);
                        if (onClearFileHighlight) {
                            onClearFileHighlight();
                        }
                    }, 1500);
                }
            }, 1000);  // Longer delay for cascading effect
        }
    }, [highlightedFileId, highlightedItemId, items, onClearFileHighlight, prefix]);

    return { shouldExpandRepliesRef };
}
