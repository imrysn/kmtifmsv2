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

    // COMMENT/REPLY/MENTION NOTIFICATIONS
    if (notification.type === 'comment' || notification.type === 'mention' || isReplyNotification) {
        if (notification.assignment_id) {
            return {
                targetTab: tabs.tasks,
                context: {
                    assignmentId: notification.assignment_id,
                    shouldOpenComments: true,
                    expandAllReplies: isReplyNotification
                },
                notificationType: notification.type === 'mention' ? 'mention' : (isReplyNotification ? 'reply' : 'comment')
            };
        }
    }

    // FILE SUBMISSION NOTIFICATIONS
    if (
        notification.type === 'submission' ||
        notification.type === 'file_uploaded' ||
        notification.type === 'file_submitted' ||
        notification.type === 'assignment'
    ) {
        // Special case: "assigned as Checker" notification — navigate to For Checking tab
        const isCheckerAssigned =
            notification.title === 'You have been assigned as Checker' ||
            notification.title?.toLowerCase().includes('assigned as checker');

        if (isCheckerAssigned && notification.assignment_id) {
            return {
                targetTab: tabs.tasks,
                context: {
                    assignmentId: notification.assignment_id,
                    forChecking: true,
                    shouldOpenComments: false
                },
                notificationType: 'checker_assigned'
            };
        }

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
        notification.type === 'final_rejection' ||
        notification.type === 'team_leader_approved' ||
        notification.type === 'team_leader_rejected' ||
        notification.type === 'admin_approved' ||
        notification.type === 'admin_rejected'
    ) {
        // For users: if there's an assignment link, always go to Tasks
        if (role === 'user' && notification.file_id && notification.assignment_id) {
            return {
                targetTab: tabs.tasks,
                context: {
                    assignmentId: notification.assignment_id,
                    fileId: notification.file_id,
                    shouldOpenComments: false
                },
                notificationType: (notification.type.includes('reject') || notification.type.includes('rejected')) ? 'rejection' : 'approval'
            };
        }
        // Non-user roles or no assignment → files/approval tab
        return {
            targetTab: role === 'admin' ? tabs.fileApproval : tabs.files,
            context: notification.file_id ? { fileId: notification.file_id } : {},
            notificationType: 'approval'
        };
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

    // CHECKER DONE NOTIFICATIONS — navigate to tasks/assignments and highlight the assignment
    if (notification.type === 'checker_done') {
        if (notification.assignment_id) {
            return {
                targetTab: tabs.tasks,
                context: {
                    assignmentId: notification.assignment_id,
                    fileId: notification.file_id || null,
                    shouldOpenComments: false
                },
                notificationType: 'checker_done'
            };
        }
    }

    // DUE SOON / OVERDUE — navigate to tasks and highlight the assignment
    if (notification.type === 'due_soon' || notification.type === 'overdue') {
        if (notification.assignment_id) {
            return {
                targetTab: tabs.tasks,
                context: {
                    assignmentId: notification.assignment_id,
                    shouldOpenComments: false
                },
                notificationType: notification.type
            };
        }
    }

    // REVISION REQUEST / FOR EDITING — navigate to tasks so user can fix and resubmit
    if (notification.type === 'revision_request' || notification.type === 'for_editing') {
        if (notification.assignment_id) {
            return {
                targetTab: tabs.tasks,
                context: {
                    assignmentId: notification.assignment_id,
                    shouldOpenComments: false
                },
                notificationType: 'revision_request'
            };
        }
    }

    // ATTACHMENT / TASK-RELATED NOTIFICATIONS with no specific type
    if (
        notification.type === 'attachment' ||
        notification.type === 'attachment_uploaded' ||
        (notification.title && notification.title.includes('Uploaded Attachment'))
    ) {
        if (notification.assignment_id) {
            return {
                targetTab: tabs.tasks,
                context: {
                    assignmentId: notification.assignment_id,
                    shouldOpenComments: false
                },
                notificationType: 'attachment'
            };
        }
    }

    // INTELLIGENT FALLBACK for missing/empty types
    if (!notification.type || notification.type === '') {
        // Both file_id and assignment_id → File submission
        if (notification.file_id && notification.assignment_id) {
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
            return {
                targetTab: role === 'admin' ? tabs.fileApproval : tabs.files,
                context: { fileId: notification.file_id },
                notificationType: 'file'
            };
        }
    }

    // Unknown notification type — no navigation
    return {
        targetTab: null,
        context: null,
        notificationType: 'unknown'
    };
}
