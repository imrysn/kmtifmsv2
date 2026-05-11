import { PremiumNotificationCenter } from '../shared';

const NotificationTab = ({ user, onNavigate, onUpdateUnreadCount }) => {
  return (
    <PremiumNotificationCenter 
      user={user}
      role="user"
      onNavigate={onNavigate}
      onUpdateUnreadCount={onUpdateUnreadCount}
    />
  );
};

export default NotificationTab;
