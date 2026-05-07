import React from 'react';
import { createPortal } from 'react-dom';
import './PerformanceInfoModal.css';

const PerformanceInfoModal = React.memo(({ isOpen, onClose, performance }) => {
  if (!isOpen) return null;

  const modalContent = (
    <div className="perf-modal-overlay" onClick={onClose}>
      <div className="perf-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="perf-modal-header">
          <div>
            <h2 className="perf-modal-title">Performance Criteria</h2>
          </div>
          <button className="perf-modal-close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
        </div>

        {performance && (
          <div className="perf-live-summary" style={{
            background: '#f8fafc',
            margin: '0 24px 20px',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Your Current Score</span>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a' }}>{performance.overallScore}%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Formula Breakdown</span>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#6366f1' }}>
                {Math.round(performance.qualityFactor * 0.45)} + {Math.round(performance.efficiencyRatio * 100 * 0.35)} + {Math.round(performance.onTimeRate * 0.20)} pts
              </div>
            </div>
          </div>
        )}

        <div className="perf-modal-body">

          <div className="perf-pillar-grid">
            <div className="perf-pillar-card">
              <h3 className="perf-pillar-name">🎯 Quality (45%)</h3>
              <div className="perf-pillar-math">
                (Approved Records / All Submission Records) × 45%
              </div>
              <p className="perf-pillar-text">
                Every file submission starts with a <strong>100% Quality baseline</strong>. When a file is rejected, that rejection is permanently logged as a record.
                If you resubmit (replace) that file, it creates a <strong>new submission record</strong> — but the old rejected record remains.
                This means fewer rejections across your entire history equals a higher Quality score.
              </p>
            </div>

            <div className="perf-pillar-card">
              <h3 className="perf-pillar-name">⚡ Speed (35%)</h3>
              <div className="perf-pillar-math">
                (Allocated Time / Time Taken to Submit) × 35%
              </div>
              <p className="perf-pillar-text">
                The calculation starts from the <strong>Task Posted Date</strong> and stops when you <strong>Submit</strong>. Only business hours (Mon–Fri) are counted — nights and weekends are excluded.
                Submitting faster than allocated boosts your score above 100%, capped at a <strong>1.5× Bonus</strong> to keep rankings fair.
              </p>
            </div>

            <div className="perf-pillar-card">
              <h3 className="perf-pillar-name">📅 Reliability (20%)</h3>
              <div className="perf-pillar-math">
                (On-Time File Weight / Total File Weight) × 20%
              </div>
              <p className="perf-pillar-text">
                At the moment you click <strong>Submit</strong>, the system checks if your timestamp is on or before the <strong>Due Date</strong>. Each submission is weighted by its file count — a batch of 10 files counts 10× more than a single file.
                Only assignments <strong>with a due date</strong> are counted. Tasks with no deadline are excluded from this.
              </p>
            </div>
          </div>

          <div className="perf-modal-formula-box">
            <div className="perf-formula-main">Performance = Quality + Speed + Reliability</div>
          </div>

          <div style={{
            marginTop: '24px',
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
              <h4 style={{ margin: '0 0 4px 0', color: '#4f46e5', fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fair Play Policy</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                Your performance metrics are strictly tied to <strong>your actions</strong>. The moment you click <strong>Submit</strong>, your Speed and Reliability are <strong>locked in</strong>. 
                Any delays in Team Leader or Admin approval times do <u>not</u> affect your scores. You are rewarded for when you finish, not when we review.
              </p>
              
              <h4 style={{ margin: '0 0 4px 0', color: '#0891b2', fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🔄 Revision Safety Net</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                If a task requires <strong>revisions</strong>, the rejection will impact your Quality score. However, Team Leaders can adjust the <strong>Due Date</strong> to give you extra time. 
                This acts as a safety net — ensuring that while your Quality takes a hit, your <strong>Speed and Reliability stay protected</strong> during the rework process.
              </p>
            </div>
          </div>

          <div className="perf-modal-star-note">
            <strong>Performance Tip:</strong> Exceed 100% via early submissions while maintaining perfect quality.
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
