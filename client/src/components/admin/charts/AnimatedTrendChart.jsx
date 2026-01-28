import React, { memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AnimatedTrendChart = memo(({ trends, loading }) => {
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                <div style={{ color: 'var(--text-tertiary)' }}>Loading chart...</div>
            </div>
        );
    }

    if (!trends || trends.length === 0) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                <div style={{ color: 'var(--text-tertiary)' }}>No data available</div>
            </div>
        );
    }

    // Custom tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                    <p style={{ margin: 0, fontWeight: 600, marginBottom: '8px' }}>
                        {payload[0].payload.month}
                    </p>
                    {payload[0] && (
                        <p style={{ margin: 0, color: '#10b981', fontSize: '14px' }}>
                            Approved: {payload[0].value}
                        </p>
                    )}
                    {payload[1] && (
                        <p style={{ margin: 0, color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>
                            Rejected: {payload[1].value}
                        </p>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ width: '100%', height: 300, display: 'block' }}>
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
                        animationDuration={800}
                        animationEasing="ease-in-out"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
});

export default AnimatedTrendChart;
