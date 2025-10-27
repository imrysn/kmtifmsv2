const FilterModal = ({
  showFilterModal,
  setShowFilterModal,
  filters,
  setFilters,
  clearFilters,
  applyFilters
}) => {
  if (!showFilterModal) return null

  return (
    <div className="tl-modal-overlay" onClick={() => setShowFilterModal(false)}>
      <div className="tl-modal" onClick={e => e.stopPropagation()}>
        <div className="tl-modal-header">
          <h3>Filter Files</h3>
          <button onClick={() => setShowFilterModal(false)}>×</button>
        </div>
        <div className="tl-modal-body">
          <div className="tl-form-group">
            <label>File Type</label>
            <input
              type="text"
              value={filters.fileType.join(', ')}
              onChange={(e) => setFilters({...filters, fileType: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
              placeholder="e.g., PDF, Word Document"
            />
          </div>
          <div className="tl-form-group">
            <label>Submitted By</label>
            <input
              type="text"
              value={filters.submittedBy.join(', ')}
              onChange={(e) => setFilters({...filters, submittedBy: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
              placeholder="Username(s)"
            />
          </div>
          <div className="tl-form-group">
            <label>Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
            />
          </div>
          <div className="tl-form-group">
            <label>Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
            />
          </div>
          <div className="tl-form-group">
            <label>Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({...filters, priority: e.target.value})}
            >
              <option value="">All Priorities</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="tl-form-group">
            <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input
                type="checkbox"
                checked={filters.hasDeadline}
                onChange={(e) => setFilters({...filters, hasDeadline: e.target.checked})}
              />
              Has Deadline
            </label>
          </div>
          <div className="tl-form-group">
            <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input
                type="checkbox"
                checked={filters.isOverdue}
                onChange={(e) => setFilters({...filters, isOverdue: e.target.checked})}
              />
              Is Overdue
            </label>
          </div>
        </div>
        <div className="tl-modal-footer">
          <button className="tl-btn secondary" onClick={clearFilters}>Clear All</button>
          <button className="tl-btn success" onClick={applyFilters}>Apply Filters</button>
        </div>
      </div>
    </div>
  )
}

export default FilterModal
