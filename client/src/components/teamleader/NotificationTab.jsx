import { PremiumNotificationCenter } from '../shared';

const NotificationTab = ({ user, onNavigate, onRead }) => {
  return (
    <PremiumNotificationCenter 
      user={user}
      role="teamleader"
      onNavigate={onNavigate}
      onUpdateUnreadCount={onRead}
    />
  );
};

export default NotificationTab;
