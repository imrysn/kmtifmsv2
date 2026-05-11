import React, { memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

/**
 * ApprovalTrendChart - Displays approval/rejection trends over time
 * Extracted from DashboardOverview for better maintainability
 */
const ApprovalTrendChart = memo(({ trends, loading }) => {
    // Memoize the chart data to prevent unnecessary object creation
    const chartData = useMemo(() => {
        if (!trends || trends.length === 0) return { labels: [], datasets: [] };

        const rawData = trends.slice(-30); // Last 30 days
        
        // Pad data if we don't have enough points to draw a line
        const data = rawData.length < 2 
            ? [{ approved: 0, rejected: 0, day: '', date: '', month: '' }, ...rawData] 
            : rawData;

        return {
            labels: data.map(t => t.month || t.day || t.date || ''),
            datasets: [
                {
                    label: 'Approved',
                    data: data.map(t => t.approved || 0),
                    borderColor: '#10B981', // Success green
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#10B981',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.3, // Smooth curve
                    fill: true
                },
                {
                    label: 'Rejected',
                    data: data.map(t => t.rejected || 0),
                    borderColor: '#EF4444', // Danger red
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#EF4444',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.3, // Smooth curve
                    fill: false
                }
            ]
        };
    }, [trends]);

    // Chart.js options
    const options = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        animation: {
            duration: 0
        },
        plugins: {
            legend: {
                position: 'top',
                align: 'end',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    font: {
                        family: "system-ui, -apple-system, sans-serif",
                        size: 12
                    }
                }
            },
            tooltip: {
                backgroundColor: '#ffffff',
                titleColor: '#1f2937',
                bodyColor: '#666666',
                borderColor: '#e5e7eb',
                borderWidth: 1,
                padding: 10,
                usePointStyle: true,
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 13 }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0, // Only show whole numbers
                    color: '#6B7280',
                    font: { size: 11 }
                },
                grid: {
                    color: '#E5E7EB',
                    drawBorder: false,
                    borderDash: [4, 4]
                }
            },
            x: {
                ticks: {
                    maxTicksLimit: 6, // Don't crowd the x-axis
                    color: '#6B7280',
                    font: { size: 11 }
                },
                grid: {
                    display: false,
                    drawBorder: false
                }
            }
        }
    }), []);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', minHeight: '200px' }}>
            {loading ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', background: 'rgba(255,255,255,0.7)', zIndex: 5 }}>
                    Loading trends...
                </div>
            ) : (!trends || trends.length === 0) ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', zIndex: 5 }}>
                    No trend data available
                </div>
            ) : null}
            
            <div style={{ width: '100%', height: '100%', visibility: (loading || !trends || trends.length === 0) ? 'hidden' : 'visible' }}>
                <Line id="approval-trend-line" data={chartData} options={options} />
            </div>
        </div>
    );
});

ApprovalTrendChart.displayName = 'ApprovalTrendChart';

ApprovalTrendChart.propTypes = {
    trends: PropTypes.arrayOf(PropTypes.shape({
        day: PropTypes.string,
        date: PropTypes.string,
        month: PropTypes.string,
        approved: PropTypes.number,
        rejected: PropTypes.number
    })),
    loading: PropTypes.bool
};

export default ApprovalTrendChart;
