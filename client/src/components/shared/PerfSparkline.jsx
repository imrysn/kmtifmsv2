import React from 'react';

const PerfSparkline = ({ data = [], width = 60, height = 24 }) => {
  if (!data || data.length < 2) return null;

  // Normalize data points to the SVG height/width
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Determine trend color
  const first = data[0];
  const last = data[data.length - 1];
  let strokeColor = '#94a3b8'; // Neutral
  if (last > first + 2) strokeColor = '#10b981'; // Trending Up
  if (last < first - 2) strokeColor = '#f43f5e'; // Trending Down

  return (
    <div className="perf-sparkline-container" style={{ width, height, display: 'flex', alignItems: 'center' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Area fill */}
        <path
          d={`M 0 ${height} L ${points} L ${width} ${height} Z`}
          fill="url(#sparkline-gradient)"
        />

        {/* The line */}
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        
        {/* Last point dot */}
        <circle 
          cx={(data.length - 1) / (data.length - 1) * width} 
          cy={height - ((last - min) / range) * height} 
          r="2.5" 
          fill={strokeColor} 
          stroke="white" 
          strokeWidth="1"
        />
      </svg>
    </div>
  );
};

export default PerfSparkline;
