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

import { useEffect, useRef, startTransition } from 'react';

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
    const shouldExpandRepliesRef = useRef(false);
    const pendingContextRef = useRef(null);

    const CLASS_PREFIX = { admin: 'admin', teamleader: 'tl', user: 'user' };
    const prefix = CLASS_PREFIX[role] || 'sn';

    const ID_PREFIX = { admin: 'admin-assignment', teamleader: 'tl-assignment', user: 'user-assignment' };
    const idPrefix = ID_PREFIX[role] || 'assignment';

    // EFFECT 1: Auto-open comments modal from notification
    // Stores context when it arrives, then opens modal once items are available.
    useEffect(() => {
        if (!notificationContext) return;
        // Save context so Effect 1b can act once items load
        pendingContextRef.current = notificationContext;
        if (onClearNotificationContext) {
            onClearNotificationContext();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [notificationContext]);

    // EFFECT 1b: Open modal once both pendingContext and items are available
    useEffect(() => {
        if (!pendingContextRef.current || items.length === 0) return;

        const ctx = pendingContextRef.current;
        const item = items.find(i => i.id === ctx.assignmentId);
        if (!item) return;

        pendingContextRef.current = null;

        if (ctx.expandAllReplies) {
            shouldExpandRepliesRef.current = true;
        }

        if (openCommentsModal) {
            openCommentsModal(item);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, openCommentsModal]);

    // EFFECT 2: Auto-expand replies when modal + comments are ready
    useEffect(() => {
        if (!showCommentsModal || !selectedItem || !shouldExpandRepliesRef.current) return;
        if (comments.length === 0) return;

        // Expand all reply threads — low priority, defer so modal paint goes first
        startTransition(() => {
            const expandState = {};
            let firstWithReplies = null;

            comments.forEach(comment => {
                if (comment.replies && comment.replies.length > 0) {
                    expandState[comment.id] = true;
                    if (!firstWithReplies) firstWithReplies = comment.id;
                }
            });

            if (setVisibleReplies) {
                setVisibleReplies(prev => ({ ...prev, ...expandState }));
            }

            // Scroll after expansion paint — single short delay
            if (firstWithReplies) {
                setTimeout(() => {
                    const el = document.querySelector(`[data-comment-id="${firstWithReplies}"]`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 150);
            }
        });

        shouldExpandRepliesRef.current = false;
    }, [showCommentsModal, selectedItem, comments, setVisibleReplies]);

    // EFFECT 3: Highlight item (scroll to assignment card)
    useEffect(() => {
        if (!highlightedItemId || items.length === 0) return;

        const element = document.getElementById(`${idPrefix}-${highlightedItemId}`);
        if (!element) return;

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add(`${prefix}-assignment-highlighted`);

        const timer = setTimeout(() => {
            element.classList.remove(`${prefix}-assignment-highlighted`);
            if (onClearHighlight) onClearHighlight();
        }, 1500);

        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightedItemId, items]);

    // EFFECT 4: Highlight file within item
    useEffect(() => {
        if (!highlightedFileId || items.length === 0) return;

        const delay = highlightedItemId ? 600 : 200;
        const timer = setTimeout(() => {
            const el = document.querySelector(`[data-file-id="${highlightedFileId}"]`);
            if (!el) return;

            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add(`${prefix}-assignment-file-highlighted`);

            setTimeout(() => {
                el.classList.remove(`${prefix}-assignment-file-highlighted`);
                if (onClearFileHighlight) onClearFileHighlight();
            }, 1500);
        }, delay);

        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightedFileId, highlightedItemId, items]);

    return { shouldExpandRepliesRef };
}
