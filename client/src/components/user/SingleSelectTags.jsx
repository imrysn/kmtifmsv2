import { useState, useRef, useEffect } from 'react';
import './css/MultiSelectTags.css';
import { FILE_TAGS } from './fileTags';

const SingleSelectTags = ({ selectedTag, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomTagModal, setShowCustomTagModal] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter out "Add New" from the regular list
  const filteredTags = FILE_TAGS
    .filter(tag => tag !== 'Add New')
    .filter(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

  const selectTag = (tag) => {
    onChange(tag);
    setIsOpen(false);
  };

  const clearTag = () => {
    onChange('');
  };

  const handleAddNewClick = () => {
    setIsOpen(false);
    setShowCustomTagModal(true);
  };

  const handleCustomTagSubmit = () => {
    const trimmedTag = customTagInput.trim();
    if (trimmedTag) {
      onChange(trimmedTag);
      setCustomTagInput('');
      setShowCustomTagModal(false);
    }
  };

  const handleCustomTagCancel = () => {
    setCustomTagInput('');
    setShowCustomTagModal(false);
  };

  return (
    <>
      <div className="user-multi-select-tags-component multi-select-container" ref={dropdownRef}>
        <div 
          className={`multi-select-input ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <div className="selected-tags-container">
            {!selectedTag ? (
              <span className="placeholder">Select a tag...</span>
            ) : (
              <span className="selected-tag">
                {selectedTag}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) clearTag();
                  }}
                  className="remove-tag-btn"
                >
                  ×
                </button>
              </span>
            )}
          </div>
          <svg 
            className={`dropdown-arrow ${isOpen ? 'open' : ''}`} 
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
          </svg>
        </div>

        {isOpen && (
          <div className="multi-select-dropdown">
            <div className="search-container">
              <div className="search-input-wrapper">
                <svg className="search-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <button
                type="button"
                onClick={handleAddNewClick}
                className="add-new-btn"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                </svg>
                Add New
              </button>
            </div>

            <div className="tags-list">
              {filteredTags.length === 0 ? (
                <div className="no-results">No tags found</div>
              ) : (
                filteredTags.map((tag, index) => (
                  <div
                    key={index}
                    className={`tag-option ${selectedTag === tag ? 'selected' : ''}`}
                    onClick={() => selectTag(tag)}
                  >
                    <span className="tag-label">{tag}</span>
                  </div>
                ))
              )}
            </div>

            {selectedTag && (
              <div className="dropdown-footer">
                <span className="selected-count">1 tag selected</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearTag();
                  }}
                  className="clear-all-btn"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Tag Modal */}
      {showCustomTagModal && (
        <div className="custom-tag-modal-overlay" onClick={handleCustomTagCancel}>
          <div className="custom-tag-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Custom Tag</h3>
              <button className="modal-close" onClick={handleCustomTagCancel}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <label className="custom-tag-label">Enter your custom tag:</label>
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomTagSubmit();
                  }
                }}
                placeholder="Type your tag name..."
                className="custom-tag-input"
                autoFocus
              />
            </div>
            
            <div className="modal-footer">
              <button
                type="button"
                onClick={handleCustomTagCancel}
                className="btn secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCustomTagSubmit}
                disabled={!customTagInput.trim()}
                className="btn primary"
              >
                Add Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SingleSelectTags;
