//  // frontend/app/dss/visualizations/vector/components/Notification.tsx
// Notification toast component

import React from 'react';
import { Notification as NotificationType } from '../types/map.types';

interface NotificationProps {
  notification: NotificationType;
}

export default function Notification({ notification }: NotificationProps) {
  if (!notification.show) return null;

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success': return 'border-green-500';
      case 'error': return 'border-red-500';
      default: return 'border-blue-500';
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'success': return 'fa-check-circle text-green-500';
      case 'error': return 'fa-exclamation-circle text-red-500';
      default: return 'fa-info-circle text-blue-500';
    }
  };

  return (
    <div 
      className={`fixed bottom-5 right-5 bg-white border-l-4 p-4 rounded-lg shadow-lg z-50 min-w-[300px] transform transition-transform ${
        notification.show ? 'translate-y-0' : 'translate-y-20'
      } ${getBorderColor()}`}
    >
      <div className="flex items-center mb-1">
        <i className={`fas ${getIcon()} mr-2 text-xl`}></i>
        <div className="font-semibold text-gray-800">{notification.title}</div>
      </div>
      <div className="text-gray-600 text-sm">{notification.message}</div>
    </div>
  );
}