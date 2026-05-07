import React, { memo, useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import './AnimatedPieChart.css';

// Register Chart.js elements — done once at module level
ChartJS.register(ArcElement, Tooltip, Legend);

// Define colors outside component to prevent re-creation on every render
const COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
    '#84cc16', '#a855f7'
];

// Chart options defined OUTSIDE the component — static, never changes, never re-created
const CHART_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    animation: {
        animateScale: false,
        animateRotate: false,
        duration: 0
    },
    resizeDelay: 250,
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                usePointStyle: true,
                padding: 16,
                font: { size: 11, family: 'system-ui, -apple-system, sans-serif' },
                // Use Chart.js built-in label generation — no custom function
                // Percentage is shown in the tooltip instead
            }
        },
        tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#1f2937',
            bodyColor: '#6b7280',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            callbacks: {
                label: (context) => {
                    const dataset = context.dataset;
                    const total = dataset.data.reduce((sum, val) => sum + val, 0);
                    const value = context.raw;
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                    return ` ${value} files (${percentage}%)`;
                }
            }
        }
    }
};

const AnimatedPieChart = memo(({ fileTypes, loading }) => {
    const chartData = useMemo(() => {
        if (!fileTypes || fileTypes.length === 0) {
            return { labels: [], datasets: [] };
        }

        const sorted = [...fileTypes].sort((a, b) => b.count - a.count);

        return {
            labels: sorted.map(item => item.file_type),
            datasets: [{
                data: sorted.map(item => item.count),
                backgroundColor: sorted.map((_, i) => COLORS[i % COLORS.length]),
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 6
            }]
        };
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
            <Doughnut
                id="file-type-donut"
                data={chartData}
                options={CHART_OPTIONS}
            />
        </div>
    );
});

AnimatedPieChart.displayName = 'AnimatedPieChart';

export default AnimatedPieChart;
