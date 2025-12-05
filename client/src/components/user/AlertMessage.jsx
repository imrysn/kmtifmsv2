import { useEffect } from 'react';
import './css/AlertMessage.css';

const AlertMessage = ({ type, message, onClose }) => {
  useEffect(() => {
    if (message) {
      // Auto-dismiss after 2 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 2000);

      // Clear timeout if component unmounts or message changes
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="alert-message-component">
      <div className={`alert alert-${type}`}>
        <span className="alert-message">{message}</span>
        <button onClick={onClose} className="alert-close">×</button>
      </div>
    </div>
  );
};

export default AlertMessage;