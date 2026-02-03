import React, { useMemo, useCallback, memo } from 'react'
import FileIcon from '../shared/FileIcon'
import { formatFileSize, mapFileStatus, getStatusDisplayName } from '../../utils/adminUtils'

const FileRow = memo(({
    file,
    onOpenModal,
    onDelete
}) => {
    const handleRowClick = useCallback(() => {
        onOpenModal(file)
    }, [file, onOpenModal])

    const handleDeleteClick = useCallback((e) => {
        e.stopPropagation()
        onDelete(file)
    }, [file, onDelete])

    const fileExtension = useMemo(() => {
        if (file.original_name) {
            const parts = file.original_name.split('.')
            if (parts.length > 1) return parts[parts.length - 1].toLowerCase()
        }
        return file.file_type?.replace(/^\./, '').toLowerCase() || ''
    }, [file.original_name, file.file_type])

    const formattedDate = useMemo(() => new Date(file.uploaded_at).toLocaleDateString(), [file.uploaded_at])
    const formattedTime = useMemo(() => new Date(file.uploaded_at).toLocaleTimeString(), [file.uploaded_at])
    const fileSize = useMemo(() => formatFileSize(file.file_size), [file.file_size])

    return (
        <tr className="file-row" onClick={handleRowClick}>
            <td>
                <div className="file-cell">
                    <div className="file-icon">
                        <FileIcon
                            fileType={fileExtension}
                            isFolder={false}
                            altText={`Icon for ${file.original_name}`}
                            size="medium"
                        />
                    </div>
                    <div className="file-details">
                        <span className="file-name">{file.original_name}</span>
                        <span className="file-size">{fileSize}</span>
                    </div>
                </div>
            </td>
            <td>
                <div className="user-cell">
                    <span className="user-name">{file.username}</span>
                </div>
            </td>
            <td>
                <div className="datetime-cell">
                    <div className="date">{formattedDate}</div>
                    <div className="time">{formattedTime}</div>
                </div>
            </td>
            <td>
                <span className="team-badge">{file.user_team}</span>
            </td>
            <td>
                <span className={`status-badge status-${mapFileStatus(file.status)}`}>
                    {getStatusDisplayName(file.status)}
                </span>
            </td>
            <td>
                <button
                    className="action-btn delete-btn"
                    onClick={handleDeleteClick}
                >
                    Delete
                </button>
            </td>
        </tr>
    )
})

export default FileRow
