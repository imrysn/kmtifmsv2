import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { apiFetch } from '@/config/api';
import './UserPerformanceCard.css';
import PerformanceInfoModal from './PerformanceInfoModal';

/**
 * UserPerformanceCard - A shared component to display user performance metrics.
 * Can be used in User Dashboard, Team Leader views, or Admin management.
 * 
 * @param {Object} props
 * @param {Object} props.user - The user object (must contain id)
 * @param {Object} [props.performanceData] - Optional pre-fetched performance data
 * @param {Object} [props.fallbackStats] - Optional fallback statistics if performance data is loading
 * @param {boolean} [props.isCollapsible] - Whether the card can be collapsed
 */
const UserPerformanceCard = memo(({ user, performanceData, fallbackStats, isCollapsible = false, onPerformanceLoad }) => {
  const [performance, setPerformance] = useState(performanceData || null);
  const [loading, setLoading] = useState(!performanceData);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [mode, setMode] = useState('production'); // 'production' or 'management'
  const lastReportedScore = useRef(null);

  const onPerformanceLoadRef = useRef(onPerformanceLoad);

  // Keep the ref updated with the latest handler without triggering re-effects
  useEffect(() => {
    onPerformanceLoadRef.current = onPerformanceLoad;
  }, [onPerformanceLoad]);

  useEffect(() => {
    let mounted = true;

    const reportScore = (data) => {
      if (onPerformanceLoadRef.current && lastReportedScore.current !== data.overallScore) {
        lastReportedScore.current = data.overallScore;
        onPerformanceLoadRef.current(data);
      }
    };

    // If data is provided via props, use it and don't fetch
    if (performanceData) {
      setPerformance(performanceData);
      setLoading(false);
      reportScore(performanceData);
      return;
    }

    // Don't fetch if already have data or currently loading
    if (performance || !user?.id) return;

    const fetchPerformance = async () => {
      try {
        setLoading(true);
        const data = await apiFetch(`/api/dashboard/user-performance/${user.id}`);
        if (data.success && mounted) {
          setPerformance(data.performance);
          reportScore(data.performance);
        }
      } catch (error) {
        console.error('Error fetching user performance:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPerformance();

    return () => { mounted = false; };
  }, [user.id, performanceData]); // Removed onPerformanceLoad from dependencies

  // Use server-computed performance metrics (accurate) with optional fallback
  const taskCompletionRate = performance?.taskCompletionRate ?? (fallbackStats?.taskCompletionRate || 0);
  const fileApprovalRate = performance?.fileApprovalRate ?? (fallbackStats?.fileApprovalRate || 0);
  const fileRejectionRate = performance?.fileRejectionRate ?? (fallbackStats?.fileRejectionRate || 0);
  const onTimeRate = performance?.onTimeRate ?? (fallbackStats?.onTimeRate || 0);
  const overallScore = performance?.overallScore ?? (fallbackStats?.overallScore || 0);

  // Accurate display counts
  const displayTaskTotal = performance?.taskTotal ?? (fallbackStats?.taskTotal || 0);
  const displayTaskSubmitted = performance?.taskSubmitted ?? (fallbackStats?.taskSubmitted || 0);
  const displayOverdue = performance?.overdue ?? (fallbackStats?.overdue || 0);
  const displayOnTimeCount = performance?.onTimeCount ?? (fallbackStats?.onTimeCount || 0);
  const displayFileTotal = performance?.fileTotal ?? (fallbackStats?.fileTotal || 0);
  const displayFileApproved = performance?.fileApproved ?? (fallbackStats?.fileApproved || 0);
  const displayFileRejected = performance?.fileRejected ?? (fallbackStats?.fileRejected || 0);

  if (loading && !fallbackStats) {
    return (
      <div className="performance-card-shared skeleton">
        <div className="skeleton-box" style={{ height: '300px', width: '100%' }} />
      </div>
    );
  }

  // Helper to format values above 100% as 100(X)%
  const formatHyperMetric = (value, color = '#6366f1') => {
    if (value > 100) {
      return (
        <>
          100<span style={{ color, fontSize: '0.85em', fontWeight: '900', verticalAlign: 'baseline' }}>({Math.round(value - 100)})</span>%
        </>
      );
    }
    return `${value}%`;
  };

  return (
    <div className={`performance-card-shared ${isCollapsed ? 'collapsed' : ''} ${mode === 'management' ? 'mode-management' : ''}`}>
      <div className="performance-card-header" onClick={() => isCollapsible && setIsCollapsed(!isCollapsed)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 className="performance-card-title">{mode === 'management' ? 'Management' : 'Performance'}</h2>

          {user?.role?.toLowerCase().replace(/[\s_]+/g, '-') === 'team-leader' && (
            <div className="perf-mode-toggle" style={{ position: 'relative', zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
              <button
                className={`perf-mode-btn ${mode === 'production' ? 'active' : ''}`}
                onClick={() => setMode('production')}
              >
                User
              </button>
              <button
                className={`perf-mode-btn ${mode === 'management' ? 'active' : ''}`}
                onClick={() => setMode('management')}
              >
                Team Leader
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="perf-info-trigger" onClick={(e) => { e.stopPropagation(); setIsInfoModalOpen(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>
          {isCollapsible && (
            <button className="collapse-toggle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points={isCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}></polyline>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="performance-content">
        {/* Hero Section: Always Visible */}
        <div className="perf-hero-bar-section">
          <div className="perf-hero-header">
            <div className="perf-hero-status-group">
              <div className="perf-hero-score">
                {formatHyperMetric(mode === 'management' ? (performance?.management?.managementScore || 0) : overallScore, mode === 'management' ? '#0891b2' : '#6366f1')}
              </div>
              <div className="perf-hero-label">
                <span className={`perf-status-dot ${(mode === 'management' ? performance?.management?.managementScore : overallScore) > 100 ? 'dot-star' :
                  (mode === 'management' ? performance?.management?.managementScore : overallScore) >= 85 ? 'dot-emerald' :
                    (mode === 'management' ? performance?.management?.managementScore : overallScore) >= 70 ? 'dot-blue' :
                      (mode === 'management' ? performance?.management?.managementScore : overallScore) >= 50 ? 'dot-amber' : 'dot-rose'
                  }`}></span>
                {mode === 'management' ? (
                  performance?.management?.managementScore >= 85 ? 'Excellent Leader' :
                    performance?.management?.managementScore >= 60 ? 'Active Leader' : 'Slow Response'
                ) : (
                  overallScore > 100 ? 'Top Performer' :
                    overallScore >= 85 ? 'Excellent' :
                      overallScore >= 70 ? 'Good' :
                        overallScore >= 50 ? 'Fair' : 'Needs Improvement'
                )}
              </div>
            </div>
          </div>

          <div className="perf-hero-bar-container">
            <div
              className={`perf-hero-bar-fill ${(mode === 'management' ? performance?.management?.managementScore : overallScore) > 100 ? 'fill-gold' :
                (mode === 'management' ? performance?.management?.managementScore : overallScore) >= 85 ? 'fill-emerald' :
                  (mode === 'management' ? performance?.management?.managementScore : overallScore) >= 70 ? 'fill-blue' :
                    (mode === 'management' ? performance?.management?.managementScore : overallScore) >= 50 ? 'fill-amber' : 'fill-rose'
                }`}
              style={{ width: `${Math.min(100, mode === 'management' ? (performance?.management?.managementScore || 0) : overallScore)}%` }}
            ></div>
          </div>
        </div>

        {!isCollapsed && (
          <div className="perf-details-content">
            <div className="perf-grid-precision">
              {mode === 'management' ? (
                <>
                  {/* Review Responsiveness */}
                  <div className="perf-metric-item">
                    <div className="perf-metric-top">
                      <span className="perf-metric-label">Responsiveness</span>
                      <div className="perf-metric-value">{performance?.management?.avgReviewHours || 0}h</div>
                    </div>
                    <div className="perf-mini-pill-container">
                      <div
                        className={`perf-mini-pill-fill ${performance?.management?.avgReviewHours <= 4 ? 'fill-green' : performance?.management?.avgReviewHours <= 24 ? 'fill-amber' : 'fill-rose'}`}
                        style={{ width: `${Math.max(5, Math.min(100, (1 - (performance?.management?.avgReviewHours / 48)) * 100))}%` }}
                      ></div>
                    </div>
                    <div className="perf-metric-footer">Avg Review Latency</div>
                  </div>

                  {/* Total Approvals */}
                  <div className="perf-metric-item">
                    <div className="perf-metric-top">
                      <span className="perf-metric-label">Throughput</span>
                      <div className="perf-metric-value">{performance?.management?.totalReviewed || 0}</div>
                    </div>
                    <div className="perf-mini-pill-container">
                      <div
                        className="perf-mini-pill-fill fill-slate"
                        style={{ width: `${Math.min(100, (performance?.management?.totalReviewed || 0) * 2)}%` }}
                      ></div>
                    </div>
                    <div className="perf-metric-footer">Total Files Reviewed</div>
                  </div>

                  {/* Queue Status */}
                  <div className="perf-metric-item">
                    <div className="perf-metric-top">
                      <span className="perf-metric-label">Queue</span>
                      <div className="perf-metric-value" style={{ color: performance?.management?.pendingReviews > 5 ? '#f43f5e' : 'inherit' }}>
                        {performance?.management?.pendingReviews || 0}
                      </div>
                    </div>
                    <div className="perf-mini-pill-container">
                      <div
                        className="perf-mini-pill-fill fill-rose"
                        style={{ width: `${Math.min(100, (performance?.management?.pendingReviews || 0) * 10)}%`, opacity: performance?.management?.pendingReviews > 0 ? 1 : 0 }}
                      ></div>
                    </div>
                    <div className="perf-metric-footer">Pending Review</div>
                  </div>
                </>
              ) : (
                <>
                  {/* Speed (Weighted Efficiency) */}
                  <div className="perf-metric-item">
                    <div className="perf-metric-top">
                      <span className="perf-metric-label">Speed</span>
                      <div className="perf-metric-value">
                        {displayTaskTotal > 0 ? formatHyperMetric(Math.round((performance?.efficiencyRatio || 0) * 100), '#10b981') : '100%'}
                      </div>
                    </div>
                    <div className="perf-mini-pill-container">
                      <div
                        className="perf-mini-pill-fill fill-green"
                        style={{ width: `${displayTaskTotal > 0 ? Math.min(100, (performance?.efficiencyRatio || 0) * 100) : 100}%` }}
                      ></div>
                    </div>
                    <div className="perf-metric-footer">Speed vs Deadline</div>
                  </div>

                  {/* Quality (Accurate) */}
                  <div className="perf-metric-item">
                    <div className="perf-metric-top">
                      <span className="perf-metric-label">Quality</span>
                      <div className="perf-metric-value">{displayFileTotal > 0 ? `${performance?.qualityFactor || 0}%` : '0%'}</div>
                    </div>
                    <div className="perf-mini-pill-container">
                      <div
                        className="perf-mini-pill-fill fill-blue"
                        style={{ width: `${displayFileTotal > 0 ? (performance?.qualityFactor || 0) : 0}%` }}
                      ></div>
                    </div>
                    <div className="perf-metric-footer">First-Pass Quality</div>
                  </div>

                  {/* Rejections (Restored) */}
                  <div className="perf-metric-item">
                    <div className="perf-metric-top">
                      <span className="perf-metric-label">Rejections</span>
                      <div className="perf-metric-value" style={{ color: displayFileRejected > 0 ? '#f43f5e' : 'inherit' }}>
                        {displayFileRejected}
                      </div>
                    </div>
                    <div className="perf-mini-pill-container">
                      <div
                        className="perf-mini-pill-fill fill-rose"
                        style={{ width: `${Math.min(100, displayFileRejected * 20)}%`, opacity: displayFileRejected > 0 ? 1 : 0.2 }}
                      ></div>
                    </div>
                    <div className="perf-metric-footer">File Rejections</div>
                  </div>

                  {/* Reliability (Accurate) */}
                  <div className="perf-metric-item">
                    <div className="perf-metric-top">
                      <span className="perf-metric-label">Reliability</span>
                      <div className="perf-metric-value">{onTimeRate}%</div>
                    </div>
                    <div className="perf-mini-pill-container">
                      <div
                        className="perf-mini-pill-fill fill-amber"
                        style={{ width: `${onTimeRate}%` }}
                      ></div>
                    </div>
                    <div className="perf-metric-footer">On-Time Delivery</div>
                  </div>

                  {/* Overdue (Restored) */}
                  <div className="perf-metric-item">
                    <div className="perf-metric-top">
                      <span className="perf-metric-label">Overdue</span>
                      <div className="perf-metric-value" style={{ color: displayOverdue > 0 ? '#f43f5e' : 'inherit' }}>
                        {displayOverdue}
                      </div>
                    </div>
                    <div className="perf-mini-pill-container">
                      <div
                        className="perf-mini-pill-fill fill-rose"
                        style={{ width: `${Math.min(100, displayOverdue * 25)}%`, opacity: displayOverdue > 0 ? 1 : 0.2 }}
                      ></div>
                    </div>
                    <div className="perf-metric-footer">Awaiting Attention</div>
                  </div>

                  {/* Completion (Restored) */}
                  <div className="perf-metric-item">
                    <div className="perf-metric-top">
                      <span className="perf-metric-label">Completion</span>
                      <div className="perf-metric-value">{displayTaskSubmitted}/{displayTaskTotal}</div>
                    </div>
                    <div className="perf-mini-pill-container">
                      <div
                        className="perf-mini-pill-fill fill-green"
                        style={{ width: `${displayTaskTotal > 0 ? (displayTaskSubmitted / displayTaskTotal) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <div className="perf-metric-footer">Tasks Finished</div>
                  </div>
                </>
              )}
            </div>

            {/* Targeted Coaching Section */}
            <div className="perf-insight-box" style={{
              marginTop: '16px',
              padding: '12px',
              background: '#f8fafc',
              borderRadius: '10px',
              borderLeft: `4px solid ${mode === 'management' ? '#0891b2' : '#6366f1'}`,
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
              <div style={{
                background: '#0f172a',
                color: 'white',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: '800',
                textTransform: 'uppercase'
              }}>TIP</div>
              <p style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#475569',
                margin: 0,
                lineHeight: '1.4'
              }}>
                {mode === 'management' ? (
                  (performance?.management?.pendingReviews || 0) > 10 ? "Pending queue is high. Consider delegating or prioritizing reviews to reduce backlog." :
                    (performance?.management?.avgReviewHours || 0) > 24 ? "Average review time is over 24h. Focus on responsiveness to improve lead score." :
                      "Leadership responsiveness is excellent. Team feedback cycles are currently optimal."
                ) : (
                  performance?.qualityFactor < 70 ? "Focus on double-checking files before submission to reduce rejections." :
                    performance?.efficiencyRatio < 0.8 ? "User is consistently exceeding deadlines. Review task complexity or time management." :
                      onTimeRate < 70 ? "Reliability is dipping. Ensure tasks are submitted before the deadline to avoid project lag." :
                        overallScore > 85 ? "Excellent performance! User is a top contributor and ready for higher-complexity tasks." :
                          "Maintain consistent output quality and speed to improve the overall performance index."
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      <PerformanceInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </div>
  );
});

export default UserPerformanceCard;
