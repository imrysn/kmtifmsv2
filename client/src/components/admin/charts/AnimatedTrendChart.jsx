import React, { memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Charts.css';

const CustomTooltip = memo(({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div className="chart-tooltip">
                <p className="chart-tooltip-title">{payload[0].payload.month}</p>
                {payload[0] && (
                    <p className="chart-tooltip-item approved">
                        Approved: {payload[0].value}
                    </p>
                )}
                {payload[1] && (
                    <p className="chart-tooltip-item rejected">
                        Rejected: {payload[1].value}
                    </p>
                )}
            </div>
        );
    }
    return null;
});

const AnimatedTrendChart = memo(({ trends, loading }) => {
    if (loading) {
        return (
            <div className="chart-loading-overlay">
                <div>Loading chart...</div>
            </div>
        );
    }

    if (!trends || trends.length === 0) {
        return (
            <div className="chart-no-data-overlay">
                <div>No data available</div>
            </div>
        );
    }

    return (
        <div className="chart-container-wrapper">
            <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                <LineChart
                    data={trends}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                        dataKey="month"
                        stroke="var(--text-tertiary)"
                        className="chart-axis-text"
                    />
                    <YAxis
                        stroke="var(--text-tertiary)"
                        className="chart-axis-text"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                        type="monotone"
                        dataKey="approved"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: '#10b981', r: 5 }}
                        activeDot={{ r: 7 }}
                        animationDuration={800}
                        animationEasing="ease-in-out"
                        isAnimationActive={true}
                    />
                    <Line
                        type="monotone"
                        dataKey="rejected"
                        stroke="#ef4444"
                        strokeWidth={3}
                        dot={{ fill: '#ef4444', r: 5 }}
                        activeDot={{ r: 7 }}
                        animationDuration={800}
                        animationEasing="ease-in-out"
                        isAnimationActive={true}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
});

export default AnimatedTrendChart;
