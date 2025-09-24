import './css/AlertMessage.css';

const AlertMessage = ({ type, message, onClose }) => {
  if (!message) return null;

  return (
    <div className={`alert alert-${type}`}>
      <span className="alert-message">{message}</span>
      <button onClick={onClose} className="alert-close">×</button>
    </div>
  );
};

export default AlertMessage;