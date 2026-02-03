import React, { memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import './Charts.css';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#84cc16', '#a855f7'];

const CustomTooltip = memo(({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        return (
            <div className="pie-tooltip" style={{ border: `2px solid ${data.payload.color}` }}>
                <p className="pie-tooltip-title" style={{ color: data.payload.color }}>{data.name}</p>
                <p className="pie-tooltip-item">Files: <strong>{data.value}</strong></p>
                <p className="pie-tooltip-item">Share: <strong>{data.payload.percentage}%</strong></p>
            </div>
        );
    }
    return null;
});

const RenderLegend = memo((props) => {
    const { payload } = props;
    if (!payload) return null;
    return (
        <div className="pie-legend-container">
            {payload.map((entry, index) => (
                <div key={`legend-${index}`} className="pie-legend-item">
                    <div className="pie-legend-color" style={{ backgroundColor: entry.color }} />
                    <span className="pie-legend-text">{entry.value}</span>
                </div>
            ))}
        </div>
    );
});

const renderLabel = (entry) => parseFloat(entry.percentage) < 5 ? '' : entry.name;

const AnimatedPieChart = memo(({ fileTypes, loading }) => {
    if (loading) return <div className="chart-loading-overlay"><div>Loading chart...</div></div>;
    if (!fileTypes || fileTypes.length === 0) return <div className="chart-no-data-overlay"><div>No data available</div></div>;

    const total = fileTypes.reduce((sum, item) => sum + item.count, 0);
    const data = fileTypes.map((item, index) => ({
        name: item.file_type,
        value: item.count,
        percentage: ((item.count / total) * 100).toFixed(1),
        color: COLORS[index % COLORS.length]
    }));

    return (
        <div className="pie-chart-container-wrapper">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="45%"
                        labelLine={{ stroke: 'var(--border-color, #e5e7eb)', strokeWidth: 1 }}
                        label={renderLabel}
                        outerRadius={85}
                        innerRadius={55}
                        dataKey="value"
                        nameKey="name"
                        animationDuration={600}
                        animationEasing="ease-out"
                        paddingAngle={2}
                    >
                        {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--background-primary, #fff)" strokeWidth={2} style={{ cursor: 'pointer' }} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<RenderLegend />} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
});

export default AnimatedPieChart;
