/**
 * Smart Navigation - Notification Parser
 * 
 * Centralized logic for parsing notifications and determining navigation targets.
 * Extracted from Team Leader implementation for reuse across all dashboards.
 */

/**
 * Parse a notification and determine navigation target and context
 * 
 * @param {Object} notification - The notification object
 * @param {string} role - User role: 'admin' | 'teamleader' | 'user'
 * @returns {Object} { targetTab, context, notificationType }
 */
export function parseNotification(notification, role) {
    console.log('🔍 Parsing notification:', { type: notification.type, role });

    // Detect reply notifications
    const isReplyNotification =
        notification.title === 'New Reply on Assignment' ||
        notification.title?.toLowerCase().includes('reply') ||
        notification.message?.toLowerCase().includes('replied to your comment');

    // Map role-specific tab names
    const TAB_MAPPING = {
        admin: {
            tasks: 'tasks',
            fileApproval: 'file-approval',
            fileManagement: 'file-management'
        },
        teamleader: {
            tasks: 'assignments',
            files: 'file-collection'
        },
        user: {
            tasks: 'tasks',
            files: 'my-files'
        }
    };

    const tabs = TAB_MAPPING[role];

    // COMMENT/REPLY NOTIFICATIONS
    if (notification.type === 'comment' || isReplyNotification) {
        if (notification.assignment_id) {
            return {
                targetTab: tabs.tasks,
                context: {
                    assignmentId: notification.assignment_id,
                    shouldOpenComments: true,
                    expandAllReplies: isReplyNotification
                },
                notificationType: isReplyNotification ? 'reply' : 'comment'
            };
        }
    }

    // FILE SUBMISSION NOTIFICATIONS
    if (
        notification.type === 'submission' ||
        notification.type === 'file_uploaded' ||
        notification.type === 'assignment'
    ) {
        if (notification.assignment_id) {
            return {
                targetTab: tabs.tasks,
                context: {
                    assignmentId: notification.assignment_id,
                    fileId: notification.file_id || null,
                    shouldOpenComments: false,
                    fromFileSubmission: true
                },
                notificationType: 'submission'
            };
        }
    }

    // APPROVAL/REJECTION NOTIFICATIONS
    if (
        notification.type === 'approval' ||
        notification.type === 'rejection' ||
        notification.type === 'final_approval' ||
        notification.type === 'final_rejection'
    ) {
        if (notification.file_id) {
            return {
                targetTab: role === 'admin' ? tabs.fileApproval : tabs.files,
                context: {
                    fileId: notification.file_id
                },
                notificationType: 'approval'
            };
        }
    }

    // PASSWORD RESET (Admin only)
    if (role === 'admin' && String(notification.type).includes('password_reset_request')) {
        return {
            targetTab: 'users',
            context: {
                userId: notification.action_by_id,
                action: 'reset-password',
                username: notification.action_by_username
            },
            notificationType: 'password_reset'
        };
    }

    // INTELLIGENT FALLBACK for missing/empty types
    if (!notification.type || notification.type === '') {
        console.log('⚠️ Empty notification type, using intelligent fallback');

        // Both file_id and assignment_id → File submission
        if (notification.file_id && notification.assignment_id) {
            console.log('📄 Fallback: File submission detected');
            return {
                targetTab: tabs.tasks,
                context: {
                    assignmentId: notification.assignment_id,
                    fileId: notification.file_id,
                    shouldOpenComments: false,
                    fromFileSubmission: true
                },
                notificationType: 'submission'
            };
        }

        // Only assignment_id → Assignment notification
        if (notification.assignment_id) {
            console.log('📋 Fallback: Assignment detected');
            return {
                targetTab: tabs.tasks,
                context: {
                    assignmentId: notification.assignment_id,
                    shouldOpenComments: false
                },
                notificationType: 'assignment'
            };
        }

        // Only file_id → File notification
        if (notification.file_id) {
            console.log('📁 Fallback: File detected');
            return {
                targetTab: role === 'admin' ? tabs.fileApproval : tabs.files,
                context: {
                    fileId: notification.file_id
                },
                notificationType: 'file'
            };
        }
    }

    // Unknown notification type
    console.warn('⚠️ Unknown notification type:', notification.type);
    return {
        targetTab: null,
        context: null,
        notificationType: 'unknown'
    };
}
