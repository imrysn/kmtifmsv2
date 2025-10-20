import { useState, useRef, useEffect } from 'react';
import './css/MultiSelectTags.css';
import { FILE_TAGS } from './fileTags';

const MultiSelectTags = ({ selectedTags, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredTags = FILE_TAGS.filter(tag =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const removeTag = (tagToRemove) => {
    onChange(selectedTags.filter(t => t !== tagToRemove));
  };

  return (
    <div className="multi-select-container" ref={dropdownRef}>
      <div 
        className={`multi-select-input ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="selected-tags-container">
          {selectedTags.length === 0 ? (
            <span className="placeholder">Select tags...</span>
          ) : (
            selectedTags.map((tag, index) => (
              <span key={index} className="selected-tag">
                {tag}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) removeTag(tag);
                  }}
                  className="remove-tag-btn"
                >
                  ×
                </button>
              </span>
            ))
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

          <div className="tags-list">
            {filteredTags.length === 0 ? (
              <div className="no-results">No tags found</div>
            ) : (
              filteredTags.map((tag, index) => (
                <div
                  key={index}
                  className={`tag-option ${selectedTags.includes(tag) ? 'selected' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  <span className="tag-label">{tag}</span>
                </div>
              ))
            )}
          </div>

          {selectedTags.length > 0 && (
            <div className="dropdown-footer">
              <span className="selected-count">{selectedTags.length} tag(s) selected</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className="clear-all-btn"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectTags;
