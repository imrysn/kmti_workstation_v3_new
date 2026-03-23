import React from 'react';
import { useModal } from '../ModalContext';
import { StatusIcon, StatusType } from '../FileIcons';

export const NotificationToast: React.FC = () => {
  const { notifications, removeNotification } = useModal();

  return (
    <div className="notifications-container">
      {notifications.map((n) => (
        <div 
          key={n.id} 
          className={`notification-toast ${n.type}`}
          onClick={() => removeNotification(n.id)}
        >
          <span className="notification-icon">
            <StatusIcon type={n.type as StatusType} size={18} />
          </span>
          <span className="notification-message">{n.message}</span>
        </div>
      ))}
    </div>
  );
};
