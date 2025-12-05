import './css/TeamFilesTab.css';
import './css/TeamFilesTab-NoAnimation.css';

const TeamFilesTab = ({ setActiveTab }) => {
  return (
    <div className="user-team-files-component dashboard-grid team-no-animation">
      <div className="dashboard-card team-files-card">
        <div className="card-header">
          <h2>Team Files</h2>
          <p className="card-subtitle">Files submitted by your team members</p>
        </div>
        <div className="placeholder-content">
          <p>This section will display files uploaded by members of your team.</p>
          <p>Currently, no team files are visible.</p>
          <button 
            className="btn btn-primary"
            onClick={() => setActiveTab('my-files')}
          >
            View Your Files
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamFilesTab;