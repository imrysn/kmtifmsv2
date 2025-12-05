import { Suspense } from 'react'
import './SkeletonLoader.css'

// Generic Skeleton Loading Component
export const SkeletonLoader = ({ type = 'dashboard' }) => {
  switch (type) {
    case 'dashboard':
      return <DashboardSkeleton />
    case 'admin':
      return <AdminSkeleton />
    case 'teamleader':
      return <TeamLeaderSkeleton />
    case 'table':
      return <TableSkeleton />
    case 'card':
      return <CardSkeleton />
    case 'grid':
      return <GridSkeleton />
    default:
      return <DashboardSkeleton />
  }
}

// Dashboard Skeleton (User Dashboard)
const DashboardSkeleton = () => (
  <div className="skeleton-container">
    {/* Sidebar Skeleton */}
    <div className="skeleton-sidebar">
      <div className="skeleton-box" style={{ height: '60px', marginBottom: '20px' }} />
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="skeleton-box" style={{ height: '48px', marginBottom: '8px' }} />
      ))}
    </div>

    {/* Main Content Skeleton */}
    <div className="skeleton-main">
      {/* Header */}
      <div className="skeleton-box" style={{ height: '80px', marginBottom: '24px' }} />

      {/* Stats Cards */}
      <div className="skeleton-stats-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-box" style={{ height: '24px', width: '60%', marginBottom: '12px' }} />
            <div className="skeleton-box" style={{ height: '36px', width: '40%' }} />
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="skeleton-content-area">
        <div className="skeleton-box" style={{ height: '32px', width: '200px', marginBottom: '20px' }} />
        <div className="skeleton-table">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton-table-row">
              <div className="skeleton-box" style={{ height: '20px', width: '30%' }} />
              <div className="skeleton-box" style={{ height: '20px', width: '20%' }} />
              <div className="skeleton-box" style={{ height: '20px', width: '25%' }} />
              <div className="skeleton-box" style={{ height: '20px', width: '15%' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

// Admin Dashboard Skeleton
const AdminSkeleton = () => (
  <div className="skeleton-container admin-skeleton">
    {/* Sidebar */}
    <div className="skeleton-sidebar">
      <div className="skeleton-box" style={{ height: '80px', marginBottom: '24px' }} />
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="skeleton-box" style={{ height: '48px', marginBottom: '8px' }} />
      ))}
      <div style={{ marginTop: 'auto' }}>
        <div className="skeleton-box" style={{ height: '48px' }} />
      </div>
    </div>

    {/* Main Content */}
    <div className="skeleton-main">
      {/* Header Cards */}
      <div className="skeleton-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-box" style={{ height: '20px', width: '50%', marginBottom: '8px' }} />
            <div className="skeleton-box" style={{ height: '32px', width: '70%' }} />
          </div>
        ))}
      </div>

      {/* Tables */}
      <div style={{ marginTop: '32px' }}>
        <div className="skeleton-box" style={{ height: '40px', width: '250px', marginBottom: '16px' }} />
        <div className="skeleton-table">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton-table-row">
              <div className="skeleton-box" style={{ height: '18px', width: '20%' }} />
              <div className="skeleton-box" style={{ height: '18px', width: '30%' }} />
              <div className="skeleton-box" style={{ height: '18px', width: '15%' }} />
              <div className="skeleton-box" style={{ height: '18px', width: '20%' }} />
              <div className="skeleton-box" style={{ height: '18px', width: '10%' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

// Team Leader Dashboard Skeleton
const TeamLeaderSkeleton = () => (
  <div className="skeleton-container tl-skeleton">
    {/* Sidebar */}
    <div className="skeleton-sidebar" style={{ width: '260px' }}>
      <div className="skeleton-box" style={{ height: '60px', marginBottom: '32px' }} />
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton-box" style={{ height: '48px', marginBottom: '12px' }} />
      ))}
      <div style={{ marginTop: 'auto' }}>
        <div className="skeleton-box" style={{ height: '48px' }} />
      </div>
    </div>

    {/* Main Content */}
    <div className="skeleton-main">
      {/* Top Bar */}
      <div className="skeleton-box" style={{ height: '70px', marginBottom: '24px' }} />

      {/* Stats Cards */}
      <div className="skeleton-stats-grid">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div className="skeleton-box" style={{ height: '20px', width: '60%', marginBottom: '8px' }} />
                <div className="skeleton-box" style={{ height: '36px', width: '40%' }} />
              </div>
              <div className="skeleton-box" style={{ height: '48px', width: '48px', borderRadius: '12px' }} />
            </div>
          </div>
        ))}
      </div>

      {/* File Review Table */}
      <div style={{ marginTop: '32px' }}>
        <div className="skeleton-box" style={{ height: '32px', width: '180px', marginBottom: '20px' }} />
        <div className="skeleton-table">
          <div className="skeleton-table-header">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="skeleton-box" style={{ height: '16px', width: '80%' }} />
            ))}
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton-table-row">
              <div className="skeleton-box" style={{ height: '20px', width: '90%' }} />
              <div className="skeleton-box" style={{ height: '20px', width: '85%' }} />
              <div className="skeleton-box" style={{ height: '20px', width: '50%' }} />
              <div className="skeleton-box" style={{ height: '20px', width: '70%' }} />
              <div className="skeleton-box" style={{ height: '20px', width: '60%' }} />
              <div className="skeleton-box" style={{ height: '20px', width: '55%' }} />
              <div className="skeleton-box" style={{ height: '28px', width: '80%' }} />
              <div className="skeleton-box" style={{ height: '32px', width: '32px', borderRadius: '6px' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

// Table Skeleton
const TableSkeleton = () => (
  <div className="skeleton-table">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className="skeleton-table-row">
        <div className="skeleton-box" style={{ height: '20px', width: '25%' }} />
        <div className="skeleton-box" style={{ height: '20px', width: '20%' }} />
        <div className="skeleton-box" style={{ height: '20px', width: '30%' }} />
        <div className="skeleton-box" style={{ height: '20px', width: '15%' }} />
      </div>
    ))}
  </div>
)

// Card Skeleton
const CardSkeleton = () => (
  <div className="skeleton-card">
    <div className="skeleton-box" style={{ height: '24px', width: '60%', marginBottom: '12px' }} />
    <div className="skeleton-box" style={{ height: '20px', width: '80%', marginBottom: '8px' }} />
    <div className="skeleton-box" style={{ height: '20px', width: '70%' }} />
  </div>
)

// Grid Skeleton (for File Management)
const GridSkeleton = () => (
  <div style={{ 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
    gap: '1rem', 
    padding: '1.5rem' 
  }}>
    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
      <div key={i} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1rem',
        borderRadius: '8px'
      }}>
        <div className="skeleton-box" style={{ 
          height: '48px', 
          width: '48px', 
          marginBottom: '0.75rem',
          borderRadius: '8px'
        }} />
        <div className="skeleton-box" style={{ 
          height: '16px', 
          width: '100%',
          marginBottom: '4px'
        }} />
        <div className="skeleton-box" style={{ 
          height: '16px', 
          width: '80%'
        }} />
      </div>
    ))}
  </div>
)

export default SkeletonLoader
