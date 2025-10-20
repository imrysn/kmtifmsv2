import './InlineSkeletonLoader.css'

// Inline skeleton loaders for use within components
export const TableRowSkeleton = ({ columns = 5 }) => (
  <tr className="skeleton-row">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i}>
        <div className="skeleton-box-inline" style={{ width: i === 0 ? '80%' : '60%' }} />
      </td>
    ))}
  </tr>
)

export const CardSkeleton = () => (
  <div className="skeleton-card-inline">
    <div className="skeleton-box-inline" style={{ height: '20px', width: '60%', marginBottom: '8px' }} />
    <div className="skeleton-box-inline" style={{ height: '32px', width: '40%' }} />
  </div>
)

export const StatCardSkeleton = () => (
  <div className="skeleton-stat-card">
    <div className="skeleton-box-inline" style={{ height: '16px', width: '50%', marginBottom: '8px' }} />
    <div className="skeleton-box-inline" style={{ height: '28px', width: '30%' }} />
  </div>
)

export const LoadingTable = ({ rows = 5, columns = 5 }) => (
  <div className="loading-table-container">
    <table style={{ width: '100%' }}>
      <thead>
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i}>
              <div className="skeleton-box-inline" style={{ height: '16px', width: '70%' }} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} columns={columns} />
        ))}
      </tbody>
    </table>
  </div>
)

export const LoadingCards = ({ count = 4 }) => (
  <div className="loading-cards-grid">
    {Array.from({ length: count }).map((_, i) => (
      <StatCardSkeleton key={i} />
    ))}
  </div>
)

export default { TableRowSkeleton, CardSkeleton, StatCardSkeleton, LoadingTable, LoadingCards }
