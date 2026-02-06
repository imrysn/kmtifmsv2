import React, { useState, useRef, useEffect } from 'react'
import './MultiSelectDropdown.css'

const MultiSelectDropdown = ({
    options = [],
    selectedIds = [],
    onChange,
    placeholder = "Select options",
    displayKey = "name",
    valueKey = "id"
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleToggle = (optionValue) => {
        const newSelectedIds = selectedIds.includes(optionValue)
            ? selectedIds.filter(id => id !== optionValue)
            : [...selectedIds, optionValue]

        console.log('🔵 MultiSelectDropdown handleToggle:', {
            clicked: optionValue,
            before: selectedIds,
            after: newSelectedIds
        })

        onChange(newSelectedIds)
    }

    const getDisplayText = () => {
        if (selectedIds.length === 0) return placeholder
        if (selectedIds.length === 1) {
            const selected = options.find(opt => opt[valueKey] === selectedIds[0])
            return selected ? selected[displayKey] : placeholder
        }
        return `${selectedIds.length} selected`
    }

    return (
        <div className="multi-select-dropdown" ref={dropdownRef}>
            <div
                className={`dropdown-header ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="dropdown-text">{getDisplayText()}</span>
                <span className="dropdown-arrow">▼</span>
            </div>

            {isOpen && (
                <div className="dropdown-list">
                    {options.map(option => (
                        <label
                            key={option[valueKey]}
                            className="dropdown-item"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(option[valueKey])}
                                onChange={() => handleToggle(option[valueKey])}
                            />
                            <span>{option[displayKey]}</span>
                        </label>
                    ))}
                    {options.length === 0 && (
                        <div className="dropdown-empty">No options available</div>
                    )}
                </div>
            )}
        </div>
    )
}

export default MultiSelectDropdown
