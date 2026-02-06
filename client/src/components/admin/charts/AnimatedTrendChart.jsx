import React, { memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './AnimatedTrendChart.css';

// CRITICAL: Define tooltip OUTSIDE component to prevent re-creation on every render/hover
const CustomTooltip = memo(({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div className="trend-chart-tooltip">
                <p className="trend-chart-tooltip-label">
                    {payload[0].payload.month}
                </p>
                {payload[0] && (
                    <div className="trend-chart-tooltip-item">
                        <div
                            className="trend-chart-tooltip-color"
                            style={{ backgroundColor: '#10b981' }}
                        />
                        <span>Approved: {payload[0].value}</span>
                    </div>
                )}
                {payload[1] && (
                    <div className="trend-chart-tooltip-item">
                        <div
                            className="trend-chart-tooltip-color"
                            style={{ backgroundColor: '#ef4444' }}
                        />
                        <span>Rejected: {payload[1].value}</span>
                    </div>
                )}
            </div>
        );
    }
    return null;
});

CustomTooltip.displayName = 'CustomTooltip';

const AnimatedTrendChart = memo(({ trends, loading }) => {
    console.log('📈 Chart Trends Data:', trends); // DEBUG Log
    if (loading) {
        return (
            <div className="trend-chart-loading">
                <div className="trend-chart-message">Loading chart...</div>
            </div>
        );
    }

    if (!trends || trends.length === 0) {
        return (
            <div className="trend-chart-empty">
                <div className="trend-chart-message">No data available</div>
            </div>
        );
    }

    return (
        <div className="trend-chart-container">
            <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                <LineChart
                    data={trends}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                        dataKey="month"
                        stroke="var(--text-tertiary)"
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis
                        stroke="var(--text-tertiary)"
                        style={{ fontSize: '12px' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                        type="monotone"
                        dataKey="approved"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: '#10b981', r: 5 }}
                        activeDot={{ r: 7 }}
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-in-out"
                    />
                    <Line
                        type="monotone"
                        dataKey="rejected"
                        stroke="#ef4444"
                        strokeWidth={3}
                        dot={{ fill: '#ef4444', r: 5 }}
                        activeDot={{ r: 7 }}
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-in-out"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
});

AnimatedTrendChart.displayName = 'AnimatedTrendChart';

export default AnimatedTrendChart;
