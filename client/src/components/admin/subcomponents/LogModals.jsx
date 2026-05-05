import React from 'react'
import './LogModals.css'
import { ConfirmationModal } from '../modals'

const LogModals = ({
  showDeleteLogsModal,
  setShowDeleteLogsModal,
  confirmDeleteLogs,
  isLoading,
  filteredLogs,
  getFilterDescription
}) => {
  return (
    <ConfirmationModal
      isOpen={showDeleteLogsModal}
      onClose={() => setShowDeleteLogsModal(false)}
      onConfirm={confirmDeleteLogs}
      title="Delete Activity Logs"
      message="Are you sure you want to delete these activity logs?"
      confirmText={`Delete ${filteredLogs.length} Log(s)`}
      variant="danger"
      isLoading={isLoading}
    >
      <p className="confirmation-description">
        You are about to delete <strong>{filteredLogs.length} log(s)</strong> that match your {getFilterDescription()}.
      </p>
      <p className="confirmation-description" style={{ marginTop: '0.5rem' }}>
        This action cannot be undone. The selected activity logs will be permanently removed from the system and cannot be recovered.
      </p>
    </ConfirmationModal>
  )
}

export default React.memo(LogModals)
