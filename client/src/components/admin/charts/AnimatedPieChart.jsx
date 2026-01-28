import React, { memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const AnimatedPieChart = memo(({ fileTypes, loading }) => {
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                <div style={{ color: 'var(--text-tertiary)' }}>Loading chart...</div>
            </div>
        );
    }

    if (!fileTypes || fileTypes.length === 0) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                <div style={{ color: 'var(--text-tertiary)' }}>No data available</div>
            </div>
        );
    }

    // Color palette for different file types
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

    // Calculate total for percentages
    const total = fileTypes.reduce((sum, item) => sum + item.count, 0);

    // Format data for pie chart
    const data = fileTypes.map((item, index) => ({
        name: item.file_type, // Fixed: Property is file_type, not type
        value: item.count,
        percentage: ((item.count / total) * 100).toFixed(1),
        color: COLORS[index % COLORS.length]
    }));

    // Custom label - show file type name instead of just percentage
    const renderLabel = (entry) => {
        // Only show label if percentage is significant enough
        if (parseFloat(entry.percentage) < 5) return '';
        return `${entry.name}`;
    };

    // Enhanced tooltip with file type at top
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            return (
                <div style={{
                    background: 'var(--background-primary, #fff)',
                    border: `2px solid ${data.payload.color}`,
                    borderRadius: '8px',
                    padding: '12px 16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                    <p style={{
                        margin: 0,
                        fontWeight: 700,
                        fontSize: '15px',
                        color: data.payload.color,
                        marginBottom: '8px'
                    }}>
                        {data.name}
                    </p>
                    <p style={{
                        margin: 0,
                        fontSize: '14px',
                        color: 'var(--text-secondary, #666)',
                        marginBottom: '4px'
                    }}>
                        Files: <strong>{data.value}</strong>
                    </p>
                    <p style={{
                        margin: 0,
                        fontSize: '14px',
                        color: 'var(--text-secondary, #666)'
                    }}>
                        Share: <strong>{data.payload.percentage}%</strong>
                    </p>
                </div>
            );
        }
        return null;
    };

    // Custom legend
    const renderLegend = (props) => {
        const { payload } = props;
        return (
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '12px',
                marginTop: '16px',
                padding: '0 20px'
            }}>
                {payload.map((entry, index) => (
                    <div
                        key={`legend-${index}`}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            color: 'var(--text-secondary, #666)'
                        }}
                    >
                        <div
                            style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '2px',
                                backgroundColor: entry.color,
                                flexShrink: 0
                            }}
                        />
                        <span style={{ fontWeight: 500 }}>
                            {entry.value} ({data[index].percentage}%)
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div style={{ width: '100%', height: 350, display: 'block' }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="45%"
                        labelLine={{
                            stroke: 'var(--border-color, #e5e7eb)',
                            strokeWidth: 1
                        }}
                        label={renderLabel}
                        outerRadius={85}
                        innerRadius={55}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        animationDuration={600}
                        animationEasing="ease-out"
                        paddingAngle={2}
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                stroke="var(--background-primary, #fff)"
                                strokeWidth={2}
                                style={{
                                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                                    cursor: 'pointer'
                                }}
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

export default AnimatedPieChart;
