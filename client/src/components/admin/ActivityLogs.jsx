import { useState, useEffect, useMemo, memo, useCallback } from 'react'
import { API_BASE_URL } from '@/config/api'
import './ActivityLogs.css'
import { AlertMessage } from './modals'
import { SkeletonLoader } from '../common/SkeletonLoader'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'

// Sub-components
import LogFilters from './subcomponents/LogFilters'
import LogTable from './subcomponents/LogTable'
import LogModals from './subcomponents/LogModals'

const ActivityLogs = ({ clearMessages, error, success, setError, setSuccess }) => {
  const { user: authUser } = useAuth()
  const { isConnected } = useNetwork()

  const [activityLogs, setActivityLogs] = useState([])
  const [logsSearchQuery, setLogsSearchQuery] = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteLogsModal, setShowDeleteLogsModal] = useState(false)
  const itemsPerPage = 12

  const fetchActivityLogs = useCallback(async (limit = 10000) => {
    setIsLoading(true)
    try {
      const url = `${API_BASE_URL}/api/activity-logs?limit=${limit}`
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setActivityLogs(data.logs)
      } else {
        setError('Failed to fetch activity logs')
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }, [setError])

  useEffect(() => {
    if (dateFilter === 'all' && isConnected) {
      fetchActivityLogs()
    }
  }, [dateFilter, isConnected, fetchActivityLogs])

  useEffect(() => {
    const timer = setTimeout(() => setSearchedQuery(logsSearchQuery), 300)
    return () => clearTimeout(timer)
  }, [logsSearchQuery])

  const filteredLogs = useMemo(() => {
    let filtered = [...activityLogs]
    if (searchedQuery.trim() !== '') {
      const query = searchedQuery.toLowerCase()
      filtered = filtered.filter(log =>
        log.username.toLowerCase().includes(query) ||
        log.role.toLowerCase().includes(query) ||
        log.team.toLowerCase().includes(query) ||
        log.activity.toLowerCase().includes(query)
      )
    }

    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp)
        switch (dateFilter) {
          case 'today': return logDate >= today
          case 'week':
            const weekAgo = new Date(today)
            weekAgo.setDate(today.getDate() - 7)
            return logDate >= weekAgo
          case 'month':
            const monthAgo = new Date(today)
            monthAgo.setMonth(today.getMonth() - 1)
            return logDate >= monthAgo
          default: return true
        }
      })
    }
    return filtered
  }, [activityLogs, searchedQuery, dateFilter])

  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentLogs = filteredLogs.slice(startIndex, endIndex)
    return { totalPages, startIndex, endIndex, currentLogs }
  }, [filteredLogs, currentPage, itemsPerPage])

  const { totalPages, currentLogs } = paginationData

  useEffect(() => {
    setCurrentPage(1)
  }, [filteredLogs])

  const exportLogs = useCallback(() => {
    const csvContent = [
      ['Username', 'Role', 'Team', 'Date & Time', 'Activity'],
      ...filteredLogs.map(log => [
        log.username,
        log.role,
        log.team,
        new Date(log.timestamp).toLocaleString(),
        log.activity
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    setSuccess('Activity logs exported successfully')
  }, [filteredLogs, setSuccess])

  const clearLogFilters = useCallback(() => {
    setLogsSearchQuery('')
    setDateFilter('all')
    setCurrentPage(1)
    setSuccess('All filters cleared')
  }, [setSuccess])

  const clearLogsSearch = useCallback(() => {
    setLogsSearchQuery('')
  }, [])

  const renderPaginationNumbers = useMemo(() => {
    const pageNumbers = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(
          <button
            key={i}
            className={`pagination-btn ${i === currentPage ? 'active' : ''}`}
            onClick={() => setCurrentPage(i)}
          >
            {i}
          </button>
        )
      }
    } else {
      pageNumbers.push(
        <button
          key={1}
          className={`pagination-btn ${1 === currentPage ? 'active' : ''}`}
          onClick={() => setCurrentPage(1)}
        >
          1
        </button>
      )

      if (currentPage > 3) {
        pageNumbers.push(<span key="ellipsis1" className="pagination-ellipsis">...</span>)
      }

      const startPage = Math.max(2, currentPage - 1)
      const endPage = Math.min(totalPages - 1, currentPage + 1)

      for (let i = startPage; i <= endPage; i++) {
        if (i !== 1 && i !== totalPages) {
          pageNumbers.push(
            <button
              key={i}
              className={`pagination-btn ${i === currentPage ? 'active' : ''}`}
              onClick={() => setCurrentPage(i)}
            >
              {i}
            </button>
          )
        }
      }

      if (currentPage < totalPages - 2) {
        pageNumbers.push(<span key="ellipsis2" className="pagination-ellipsis">...</span>)
      }

      if (totalPages > 1) {
        pageNumbers.push(
          <button
            key={totalPages}
            className={`pagination-btn ${totalPages === currentPage ? 'active' : ''}`}
            onClick={() => setCurrentPage(totalPages)}
          >
            {totalPages}
          </button>
        )
      }
    }
    return pageNumbers
  }, [totalPages, currentPage])

  const getFilterDescription = useCallback(() => {
    const hasSearchFilter = logsSearchQuery.trim() !== ''
    const hasDateFilter = dateFilter !== 'all'
    if (hasSearchFilter && hasDateFilter) {
      const dateFilterText = { 'today': 'today', 'week': 'this week', 'month': 'this month' }[dateFilter]
      return `search "${logsSearchQuery}" and ${dateFilterText}`
    } else if (hasSearchFilter) {
      return `search "${logsSearchQuery}"`
    } else if (hasDateFilter) {
      const dateFilterText = { 'today': 'today', 'week': 'this week', 'month': 'this month' }[dateFilter]
      return `date filter "${dateFilterText}"`
    }
    return 'current filters'
  }, [logsSearchQuery, dateFilter])

  const deleteFilteredLogs = useCallback(() => {
    const hasSearchFilter = logsSearchQuery.trim() !== ''
    const hasDateFilter = dateFilter !== 'all'
    if (!hasSearchFilter && !hasDateFilter) {
      setError('Please apply a search term or date filter to specify logs for deletion')
      return
    }
    if (filteredLogs.length === 0) {
      setError('No logs found matching your current filter criteria')
      return
    }
    setShowDeleteLogsModal(true)
  }, [logsSearchQuery, dateFilter, filteredLogs.length, setError])

  const confirmDeleteLogs = useCallback(async () => {
    const logIdsToDelete = filteredLogs.map(log => log.id)
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/activity-logs/bulk-delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logIds: logIdsToDelete })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete logs')

      const updatedActivityLogs = activityLogs.filter(log => !logIdsToDelete.includes(log.id))
      setActivityLogs(updatedActivityLogs)
      setCurrentPage(1)
      setShowDeleteLogsModal(false)
      setSuccess(`Successfully deleted ${data.deletedCount || filteredLogs.length} log(s)`)
    } catch (error) {
      console.error('Error deleting logs:', error)
      setError(`Failed to delete logs: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [filteredLogs, activityLogs, setError, setSuccess])

  if (!isConnected) return <SkeletonLoader type="table" />

  return (
    <div className={`activity-logs-section ${isLoading ? 'loading-cursor' : ''}`}>
      <LogFilters
        logsSearchQuery={logsSearchQuery}
        setLogsSearchQuery={setLogsSearchQuery}
        clearLogsSearch={clearLogsSearch}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        clearLogFilters={clearLogFilters}
        filteredLogs={filteredLogs}
        isLoading={isLoading}
        deleteFilteredLogs={deleteFilteredLogs}
        exportLogs={exportLogs}
      />

      {error && <AlertMessage type="error" message={error} onClose={clearMessages} />}
      {success && <AlertMessage type="success" message={success} onClose={clearMessages} />}

      <LogTable
        isLoading={isLoading}
        currentLogs={currentLogs}
        filteredLogs={filteredLogs}
        totalPages={totalPages}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        setCurrentPage={setCurrentPage}
        renderPaginationNumbers={renderPaginationNumbers}
      />

      <LogModals
        showDeleteLogsModal={showDeleteLogsModal}
        setShowDeleteLogsModal={setShowDeleteLogsModal}
        confirmDeleteLogs={confirmDeleteLogs}
        isLoading={isLoading}
        filteredLogs={filteredLogs}
        getFilterDescription={getFilterDescription}
      />
    </div>
  )
}

export default withErrorBoundary(memo(ActivityLogs), {
  componentName: 'Activity Logs'
})
