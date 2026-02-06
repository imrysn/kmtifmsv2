import React, { memo } from 'react';
import PropTypes from 'prop-types';

/**
 * ApprovalTrendChart - Displays approval/rejection trends over time
 * Extracted from DashboardOverview for better maintainability
 */
const ApprovalTrendChart = memo(({ trends, loading }) => {
    if (loading) {
        return <div style={{ padding: '1rem', textAlign: 'center' }}>Loading trends...</div>;
    }

    if (!trends || trends.length === 0) {
        return <div style={{ padding: '1rem', textAlign: 'center' }}>No trend data available</div>;
    }

    const data = trends.slice(-30); // Last 30 days
    const maxValue = Math.max(
        ...data.map(t => Math.max(t.approved || 0, t.rejected || 0)),
        1
    );

    const padding = { left: 50, right: 50, top: 30, bottom: 50 };
    const chartWidth = 700 - padding.left - padding.right;
    const chartHeight = 300 - padding.top - padding.bottom;
    const stepX = chartWidth / Math.max(data.length - 1, 1);

    // Calculate points for approved and rejected lines
    const approvedPoints = data.map((t, i) => ({
        x: padding.left + i * stepX,
        y: padding.top + chartHeight - ((t.approved || 0) / maxValue) * chartHeight
    }));

    const rejectedPoints = data.map((t, i) => ({
        x: padding.left + i * stepX,
        y: padding.top + chartHeight - ((t.rejected || 0) / maxValue) * chartHeight
    }));

    return (
        <svg
            width="100%"
            height="300"
            viewBox="0 0 700 300"
            preserveAspectRatio="xMidYMid meet"
            style={{ background: 'transparent' }}
        >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padding.top + chartHeight - ratio * chartHeight;
                return (
                    <line
                        key={ratio}
                        x1={padding.left}
                        y1={y}
                        x2={padding.left + chartWidth}
                        y2={y}
                        stroke="#E5E7EB"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                    />
                );
            })}

            {/* Approved line */}
            {approvedPoints.map((point, i) => {
                if (i === 0) return null;
                const prevPoint = approvedPoints[i - 1];
                return (
                    <line
                        key={`approved-${i}`}
                        x1={prevPoint.x}
                        y1={prevPoint.y}
                        x2={point.x}
                        y2={point.y}
                        stroke="#10B981"
                        strokeWidth="3"
                    />
                );
            })}

            {/* Rejected line */}
            {rejectedPoints.map((point, i) => {
                if (i === 0) return null;
                const prevPoint = rejectedPoints[i - 1];
                return (
                    <line
                        key={`rejected-${i}`}
                        x1={prevPoint.x}
                        y1={prevPoint.y}
                        x2={point.x}
                        y2={point.y}
                        stroke="#EF4444"
                        strokeWidth="3"
                    />
                );
            })}

            {/* Approved points */}
            {approvedPoints.map((point, i) => (
                <circle
                    key={`approved-point-${i}`}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="#10B981"
                />
            ))}

            {/* Rejected points */}
            {rejectedPoints.map((point, i) => (
                <circle
                    key={`rejected-point-${i}`}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="#EF4444"
                />
            ))}

            {/* X-axis labels - Show every 5th day to avoid crowding */}
            {data.map((t, i) => {
                if (i % 5 !== 0 && i !== data.length - 1) return null;
                const x = padding.left + i * stepX;
                const label = t.month || t.day || t.date || `D${i + 1}`;
                return (
                    <text
                        key={`label-${i}`}
                        x={x}
                        y={padding.top + chartHeight + 30}
                        fontSize="11"
                        fill="#6B7280"
                        textAnchor="middle"
                    >
                        {label}
                    </text>
                );
            })}

            {/* Legend */}
            <g transform={`translate(${padding.left}, 10)`}>
                <circle cx="0" cy="0" r="4" fill="#10B981" />
                <text x="10" y="4" fontSize="12" fill="#6B7280">Approved</text>
                <circle cx="80" cy="0" r="4" fill="#EF4444" />
                <text x="90" y="4" fontSize="12" fill="#6B7280">Rejected</text>
            </g>
        </svg>
    );
});

ApprovalTrendChart.displayName = 'ApprovalTrendChart';

ApprovalTrendChart.propTypes = {
    trends: PropTypes.arrayOf(PropTypes.shape({
        day: PropTypes.string,
        date: PropTypes.string,
        approved: PropTypes.number,
        rejected: PropTypes.number
    })),
    loading: PropTypes.bool
};

export default ApprovalTrendChart;
