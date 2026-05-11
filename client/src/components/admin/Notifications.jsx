import { PremiumNotificationCenter } from '../shared';
import { withErrorBoundary } from '../common';

const Notifications = ({ user, onNavigate, onRead }) => {
  return (
    <PremiumNotificationCenter 
      user={user}
      role="admin"
      onNavigate={onNavigate}
      onUpdateUnreadCount={onRead}
    />
  );
};

export default withErrorBoundary(Notifications, {
  componentName: 'Notifications'
});
