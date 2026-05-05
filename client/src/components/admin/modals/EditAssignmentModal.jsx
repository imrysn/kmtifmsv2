import React, { useState, useEffect, useRef } from 'react'
import FileIcon from '../../shared/FileIcon'
import './FormModal.css'

const EditAssignmentModal = ({
  isOpen,
  onClose,
  assignment,
  teamMembers,
  onUpdate,
  isProcessing
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    fileTypeRequired: '',
    assignedMembers: []
  })
  
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (isOpen && assignment) {
      setFormData({
        title: assignment.title || '',
        description: assignment.description || '',
        dueDate: assignment.due_date ? new Date(assignment.due_date).toISOString().split('T')[0] : '',
        fileTypeRequired: assignment.file_type_required || '',
        assignedMembers: (assignment.assigned_member_details || assignment.members || []).map(m => m.id || m.user_id)
      })
    }
  }, [isOpen, assignment])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && !buttonRef.current.contains(event.target)) {
        setShowMemberDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!isOpen) return null

  const toggleMember = (memberId) => {
    setFormData(prev => ({
      ...prev,
      assignedMembers: prev.assignedMembers.includes(memberId)
        ? prev.assignedMembers.filter(id => id !== memberId)
        : [...prev.assignedMembers, memberId]
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onUpdate(assignment.id, formData)
  }

  const getSelectedText = () => {
    if (formData.assignedMembers.length === 0) return 'Select members...'
    if (formData.assignedMembers.length === 1) {
      const member = teamMembers.find(m => m.id === formData.assignedMembers[0])
      return member ? member.name || member.username : '1 member selected'
    }
    return `${formData.assignedMembers.length} members selected`
  }

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-content medium">
        <div className="admin-modal-header">
          <h3>Edit Assignment</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            <div className="form-group">
              <label>Assignment Title</label>
              <input 
                type="text" 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea 
                rows="3" 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Due Date</label>
                <input 
                  type="date" 
                  value={formData.dueDate} 
                  onChange={e => setFormData({...formData, dueDate: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <label>File Type Required</label>
                <select 
                  value={formData.fileTypeRequired} 
                  onChange={e => setFormData({...formData, fileTypeRequired: e.target.value})}
                >
                  <option value="">Any type</option>
                  <option value="PDF">PDF</option>
                  <option value="DWG">DWG/CAD</option>
                  <option value="Word">Word</option>
                  <option value="Excel">Excel</option>
                  <option value="Image">Image</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Assign To Members</label>
              <div className="custom-dropdown-wrapper">
                <button 
                  type="button" 
                  ref={buttonRef}
                  className="dropdown-trigger" 
                  onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                >
                  {getSelectedText()}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                
                {showMemberDropdown && (
                  <div className="dropdown-menu" ref={dropdownRef}>
                    {teamMembers.map(member => (
                      <label key={member.id} className="dropdown-item">
                        <input 
                          type="checkbox" 
                          checked={formData.assignedMembers.includes(member.id)} 
                          onChange={() => toggleMember(member.id)} 
                        />
                        <span>{member.name || member.username}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="admin-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isProcessing}>
              {isProcessing ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditAssignmentModal
