import React from 'react'
import { ConfirmationModal } from '../modals'

const NotificationModals = ({
  showDeleteAllModal,
  setShowDeleteAllModal,
  handleDeleteAll,
  isDeleting,
  totalCount,
  unreadCount
}) => {
  return (
    <ConfirmationModal
      isOpen={showDeleteAllModal}
      onClose={() => setShowDeleteAllModal(false)}
      onConfirm={handleDeleteAll}
      title="Delete All Notifications"
      message="Are you sure you want to delete all notifications?"
      confirmText="Delete All"
      cancelText="Cancel"
      variant="danger"
      isLoading={isDeleting}
      itemInfo={{
        name: `${totalCount} notification${totalCount !== 1 ? 's' : ''}`,
        details: `Including ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
      }}
    >
      <p className="warning-text">
        This action cannot be undone. All notifications will be permanently removed from your account.
      </p>
    </ConfirmationModal>
  )
}

export default React.memo(NotificationModals)
