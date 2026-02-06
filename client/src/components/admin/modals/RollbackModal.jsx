import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, History, AlertTriangle, CheckCircle } from 'lucide-react';
import './RollbackModal.css'; // We'll create this or use inline styles

const RollbackModal = ({ isOpen, onClose, currentVersion }) => {
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchReleases();
        }
    }, [isOpen]);

    const fetchReleases = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('https://api.github.com/repos/imrysn/kmtifmsv2/releases');
            if (!response.ok) throw new Error('Failed to fetch releases');
            const data = await response.json();
            setReleases(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (url) => {
        if (window.electron && window.electron.openExternal) {
            window.electron.openExternal(url);
        } else {
            // Fallback
            window.open(url, '_blank');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content rollback-modal">
                <div className="modal-header">
                    <div className="modal-title-row">
                        <History size={24} className="modal-icon" />
                        <h2>Version History & Rollback</h2>
                    </div>
                    <button className="close-button" onClick={onClose}><X size={24} /></button>
                </div>

                <div className="modal-body">
                    <div className="info-banner">
                        <AlertTriangle size={16} />
                        <p>Select a version to download the installer. You must verify the version number before installing.</p>
                    </div>

                    Current Version: <strong>{currentVersion}</strong>

                    {loading && <div className="loading-spinner">Loading releases...</div>}
                    {error && <div className="error-message">Error: {error}</div>}

                    {!loading && !error && (
                        <div className="releases-list">
                            {releases.map(release => {
                                const installerAsset = release.assets.find(a => a.name.endsWith('.exe'));
                                const isCurrent = release.tag_name === currentVersion || release.tag_name === `v${currentVersion}` || `v${release.tag_name}` === currentVersion;

                                return (
                                    <div key={release.id} className={`release-item ${isCurrent ? 'current' : ''}`}>
                                        <div className="release-info">
                                            <div className="release-tag">
                                                {release.tag_name}
                                                {release.prerelease && <span className="tag prerelease">Pre-release</span>}
                                                {isCurrent && <span className="tag current-tag">Current</span>}
                                            </div>
                                            <div className="release-date">
                                                {new Date(release.published_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="release-actions">
                                            {installerAsset ? (
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => handleDownload(release.html_url)} // Open release page is safer than direct exe link often
                                                    title="Open Release Page"
                                                >
                                                    <ExternalLink size={14} style={{ marginRight: '5px' }} />
                                                    Download
                                                </button>
                                            ) : (
                                                <span className="no-asset">No Installer</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RollbackModal;
