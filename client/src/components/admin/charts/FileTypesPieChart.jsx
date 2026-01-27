import React, { memo } from 'react';
import PropTypes from 'prop-types';

/**
 * FileTypesPieChart - Displays file types distribution as a donut chart
 * Extracted from DashboardOverview for better maintainability
 */
const FileTypesPieChart = memo(({ fileTypes, loading }) => {
    if (loading) {
        return <div style={{ padding: '1rem', textAlign: 'center' }}>Loading file types...</div>;
    }

    if (!fileTypes || fileTypes.length === 0) {
        return <div style={{ padding: '1rem', textAlign: 'center' }}>No file type data available</div>;
    }

    const total = fileTypes.reduce((sum, t) => sum + t.count, 0);
    const colors = [
        '#6366F1', '#10B981', '#F59E0B', '#EF4444',
        '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
        '#F97316', '#14B8A6', '#A855F7', '#F43F5E'
    ];

    let offset = 0;
    const circles = fileTypes.map((fileType, i) => {
        const percentage = (fileType.count / total) * 100;
        const dashArray = `${(percentage / 100) * 440} 440`;
        const circle = (
            <circle
                key={fileType.file_type}
                cx="100"
                cy="100"
                r="70"
                fill="none"
                stroke={colors[i % colors.length] || '#999'}
                strokeWidth="30"
                strokeDasharray={dashArray}
                strokeDashoffset={-offset}
            />
        );
        offset += (percentage / 100) * 440;
        return circle;
    });

    return (
        <>
            <svg width="100%" height="300" viewBox="0 0 200 200">
                {circles}
            </svg>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <div style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: '8px'
                }}>
                    {fileTypes.map((t, i) => (
                        <span key={t.file_type} style={{ whiteSpace: 'nowrap' }}>
                            <span style={{ color: colors[i % colors.length] || '#999' }}>■</span>
                            &nbsp;{t.file_type || 'Unknown'} ({t.count})
                        </span>
                    ))}
                </div>
            </div>
        </>
    );
});

FileTypesPieChart.displayName = 'FileTypesPieChart';

FileTypesPieChart.propTypes = {
    fileTypes: PropTypes.arrayOf(PropTypes.shape({
        file_type: PropTypes.string,
        count: PropTypes.number
    })),
    loading: PropTypes.bool
};

export default FileTypesPieChart;
