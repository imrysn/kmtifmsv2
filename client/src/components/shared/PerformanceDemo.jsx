import UserPerformanceCard from './UserPerformanceCard';

const PerformanceDemo = () => {
  const demoUsers = [
    {
      user: { id: 'demo1', name: 'Bryan Bergonia', email: 'bryanpogi@kmti.demo' },
      data: {
        overallScore: 112,
        efficiencyRatio: 1.45,
        qualityFactor: 100,
        onTimeRate: 100,
        taskTotal: 12,
        taskSubmitted: 12,
        fileTotal: 45,
        fileApproved: 45,
        fileRejected: 0,
        overdue: 0
      }
    },
    {
      user: { id: 'demo2', name: 'John Vincent', email: 'jv@kmti.demo' },
      data: {
        overallScore: 92,
        efficiencyRatio: 1.1,
        qualityFactor: 95,
        onTimeRate: 90,
        taskTotal: 10,
        taskSubmitted: 9,
        fileTotal: 30,
        fileApproved: 28,
        fileRejected: 1,
        overdue: 0
      }
    },
    {
      user: { id: 'demo3', name: 'User Demo', email: 'userdemo@kmti.demo' },
      data: {
        overallScore: 21,
        efficiencyRatio: 0.35,
        qualityFactor: 40,
        onTimeRate: 50,
        taskTotal: 8,
        taskSubmitted: 3,
        fileTotal: 15,
        fileApproved: 5,
        fileRejected: 8,
        overdue: 3
      }
    }
  ];

  return (
    <div className="performance-demo-container" style={{ padding: '40px', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>Performance Demo</h1>
        <p style={{ color: '#64748b' }}>This data shows a demo of the new <span style={{ fontWeight: 'bold' }}>Performance Metrics</span> of each team members.</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '24px'
      }}>
        {demoUsers.map(item => {
          const isStar = item.data.overallScore > 100;
          const isExcellent = item.data.overallScore >= 85 && item.data.overallScore <= 100;

          return (
            <div key={item.user.id} className={`demo-card-wrapper ${isStar ? 'card-star' : isExcellent ? 'card-excellent' : ''}`} style={{
              background: '#ffffff',
              border: (isStar || isExcellent) ? 'none' : '1px solid #f1f5f9',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: (isStar || isExcellent) ? 'none' : '0 4px 20px rgba(0,0,0,0.03)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.3s ease'
            }}>
              {isStar && (
                <div className="perf-star-badge">
                  <span>TOP</span>
                </div>
              )}
              {isExcellent && (
                <div className="perf-star-badge badge-excellent">
                  <span>PRO</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: isStar ? 'rgba(99, 102, 241, 0.1)' : isExcellent ? 'rgba(16, 185, 129, 0.1)' : '#f1f5f9',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '900',
                  color: isStar ? '#6366f1' : isExcellent ? '#10b981' : '#475569',
                  border: isStar ? '1px solid rgba(99, 102, 241, 0.2)' : isExcellent ? '1px solid rgba(16, 185, 129, 0.2)' : 'none'
                }}>
                  {item.user.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{item.user.name}</h3>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>{item.user.email}</span>
                </div>
              </div>

              <UserPerformanceCard
                user={item.user}
                performanceData={item.data}
                isCollapsible={true}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PerformanceDemo;
