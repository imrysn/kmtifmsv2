import React, { memo, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import './AnimatedPieChart.css';

// CRITICAL: Define all helpers OUTSIDE component to prevent re-creation on every render/hover
const COLORS = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#14b8a6', // Teal
    '#6366f1', // Indigo
    '#84cc16', // Lime
    '#a855f7'  // Violet
];

// Enhanced tooltip with file type at top
const CustomTooltip = memo(({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        return (
            <div
                className="pie-chart-tooltip"
                style={{ borderColor: data.payload.color }}
            >
                <p
                    className="pie-chart-tooltip-label"
                    style={{ color: data.payload.color }}
                >
                    {data.name}
                </p>
                <p className="pie-chart-tooltip-info">
                    Files: <strong>{data.value}</strong>
                </p>
                <p className="pie-chart-tooltip-info">
                    Share: <strong>{data.payload.percentage}%</strong>
                </p>
            </div>
        );
    }
    return null;
});

CustomTooltip.displayName = 'CustomTooltip';

// Custom legend
const renderLegend = (props) => {
    const { payload } = props;

    // Sort payload by value descending to match chart order
    const sortedPayload = [...payload].sort((a, b) => b.payload.value - a.payload.value);

    return (
        <div className="pie-chart-legend">
            {sortedPayload.map((entry, index) => (
                <div key={`legend-${index}`} className="pie-chart-legend-item">
                    <div
                        className="pie-chart-legend-color"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="pie-chart-legend-text">
                        {entry.value} ({entry.payload.percentage}%)
                    </span>
                </div>
            ))}
        </div>
    );
};

const AnimatedPieChart = memo(({ fileTypes, loading }) => {
    // Memoize data calculation to avoid re-calculation on every render
    const data = useMemo(() => {
        if (!fileTypes || fileTypes.length === 0) return [];

        const total = fileTypes.reduce((sum, item) => sum + item.count, 0);

        // Sort by count descending so largest segments appear first
        return [...fileTypes]
            .sort((a, b) => b.count - a.count)
            .map((item, index) => ({
                name: item.file_type,
                value: item.count,
                percentage: ((item.count / total) * 100).toFixed(1),
                color: COLORS[index % COLORS.length]
            }));
    }, [fileTypes]);

    if (loading) {
        return (
            <div className="pie-chart-loading">
                <div className="pie-chart-message">Loading chart...</div>
            </div>
        );
    }

    if (!fileTypes || fileTypes.length === 0) {
        return (
            <div className="pie-chart-empty">
                <div className="pie-chart-message">No data available</div>
            </div>
        );
    }

    return (
        <div className="pie-chart-container">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        isAnimationActive={true}
                        animationDuration={600}
                        animationEasing="ease-out"
                        paddingAngle={2}
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                            />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={renderLegend} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
});

AnimatedPieChart.displayName = 'AnimatedPieChart';

export default AnimatedPieChart;
