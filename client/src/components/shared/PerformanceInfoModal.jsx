import React from 'react';
import { createPortal } from 'react-dom';
import './PerformanceInfoModal.css';

const PerformanceInfoModal = React.memo(({ isOpen, onClose, performance }) => {
  if (!isOpen) return null;

  const overallScore = performance?.overallScore ?? 0;
  const qualityFactor = performance?.qualityFactor ?? 0;
  const efficiencyRatio = performance?.efficiencyRatio ?? 0;
  const onTimeRate = performance?.onTimeRate ?? 0;
  const fileRejected = performance?.fileRejected ?? 0;
  const overdue = performance?.overdue ?? 0;

  const qualityPts = Math.round(qualityFactor * 0.45);
  const speedPts = Math.round(Math.min(150, efficiencyRatio * 100) * 0.35);
  const reliabilityPts = Math.round(onTimeRate * 0.20);

  const modalContent = (
    <div className="perf-modal-overlay" onClick={onClose}>
      <div className="perf-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="perf-modal-header">
          <div>
            <h2 className="perf-modal-title">Performance Criteria</h2>
          </div>
          <button className="perf-modal-close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>
        </div>

        {performance && (
          <div className="perf-live-summary" style={{
            background: 'var(--background-secondary)',
            margin: '0 24px 20px',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Your Current Score</span>
              <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>{overallScore}%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Formula Breakdown</span>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#6366f1' }}>
                {qualityPts} + {speedPts} + {reliabilityPts} pts
              </div>
              {(fileRejected > 0 || overdue > 0) && (
                <div style={{ fontSize: '12px', color: '#f43f5e', fontWeight: '600', marginTop: '4px' }}>
                  {fileRejected > 0 && <span>⚠ {fileRejected} rejection{fileRejected > 1 ? 's' : ''} penalizing Quality</span>}
                  {fileRejected > 0 && overdue > 0 && <span> · </span>}
                  {overdue > 0 && <span>⚠ {overdue} overdue penalizing Speed &amp; Reliability</span>}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="perf-modal-body">

          <div className="perf-pillar-grid">
            <div className="perf-pillar-card">
              <h3 className="perf-pillar-name">🎯 Quality (45%)</h3>
              <div className="perf-pillar-math">
                {performance ? (
                  <>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{Math.round(qualityFactor)}%</span> × 45% = <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{qualityPts} pts</span>
                  </>
                ) : (
                  '(Base Quality Score × Rejection Penalty) × 45%'
                )}
              </div>
              <p className="perf-pillar-text" style={{ fontSize: '12.5px', lineHeight: '1.6' }}>
                Every file starts with a <strong>100% Quality baseline</strong>. When a file is returned for editing, the checker assigns a <strong>specific deduction percentage</strong> (e.g., −10%, −35%). This is <strong>directly subtracted</strong> from the file's perfect score.
                <br/><br/>
                Your overall quality drops in two ways: 
                <br/>• The <strong>direct deduction</strong> lowers the file's base score.
                <br/>• The <strong>rejection ratio</strong> (rejected ÷ total files) applies an extra penalty multiplier.
              </p>
            </div>

            <div className="perf-pillar-card">
              <h3 className="perf-pillar-name">⚡ Speed (35%)</h3>
              <div className="perf-pillar-math">
                {performance ? (
                  <>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{Math.round(Math.min(150, efficiencyRatio * 100))}%</span> × 35% = <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{speedPts} pts</span>
                  </>
                ) : (
                  '(Submission Speed Factor − Overdue Penalty) × 35%'
                )}
              </div>
              <p className="perf-pillar-text">
                The calculation starts from the <strong>Task Posted Date</strong> and stops when you <strong>Submit</strong>. 
                Submitting faster than allocated boosts your score (capped at <strong>1.5× Bonus</strong>).
                <strong> Each overdue task reduces your Speed score by 5%</strong>, up to a max of −50%.
              </p>
            </div>

            <div className="perf-pillar-card">
              <h3 className="perf-pillar-name">📅 Reliability (20%)</h3>
              <div className="perf-pillar-math">
                {performance ? (
                  <>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{Math.round(onTimeRate)}%</span> × 20% = <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{reliabilityPts} pts</span>
                  </>
                ) : (
                  '(On-Time Files / (Total Files + Overdue)) × 20%'
                )}
              </div>
              <p className="perf-pillar-text">
                At the moment you click <strong>Submit</strong>, the system checks if your timestamp is on or before the <strong>Due Date</strong>.
                <strong> Each overdue task also counts as a missed deadline</strong>, directly reducing your Reliability rate alongside your on-time submissions.
              </p>
            </div>
          </div>

          <div className="perf-modal-formula-box">
            <div className="perf-formula-main">Performance = Quality + Speed + Reliability</div>
          </div>

          {/* Penalty Summary */}
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: 'rgba(244, 63, 94, 0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(244, 63, 94, 0.15)',
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#f43f5e', fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚠ Penalty Rules
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Rejections → Quality ↓</strong><br />
                Each rejected file lowers your quality score through a rejection ratio multiplier. The more rejections you accumulate, the lower your quality.
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Overdue → Speed ↓ &amp; Reliability ↓</strong><br />
                Each overdue task cuts Speed by 5% (max −50%) and is counted as a missed deadline in your Reliability rate.
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: 'rgba(99, 102, 241, 0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(99, 102, 241, 0.1)',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start'
          }}>
            <div style={{ fontSize: '24px' }}>🛡️</div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: 'var(--status-review-text)', fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fair Play Policy</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Your performance metrics are strictly tied to <strong>your actions</strong>. The moment you click <strong>Submit</strong>, your Speed and Reliability are <strong>locked in</strong>. 
                Any delays in Team Leader or Admin approval times do <u>not</u> affect your scores. You are rewarded for when you finish, not when we review.
              </p>
              
              <h4 style={{ margin: '0 0 4px 0', color: 'var(--status-review-text)', fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🔄 Revision Safety Net</h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                If a task requires <strong>revisions</strong>, the rejection will impact your Quality score. However, Team Leaders can adjust the <strong>Due Date</strong> to give you extra time. 
                This acts as a safety net — ensuring that while your Quality takes a hit, your <strong>Speed and Reliability stay protected</strong> during the rework process.
              </p>
            </div>
          </div>

          <div className="perf-modal-star-note">
            <strong>Performance Tip:</strong> Avoid overdue tasks and rejections — submit on time with high quality to maximize all three scores.
          </div>
        </div>

        <div className="perf-modal-footer">
          <button className="perf-modal-btn-close" onClick={onClose}>I Understand</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
});

export default PerformanceInfoModal;
