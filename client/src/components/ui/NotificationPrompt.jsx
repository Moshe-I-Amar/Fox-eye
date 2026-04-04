import React from 'react';
import Button from './Button';
import useNotifications from '../../hooks/useNotifications';

/**
 * NotificationPrompt — renders a compact inline banner to manage push
 * notification permission. Shows nothing if browser doesn't support push or
 * if the user has already blocked notifications.
 */
const NotificationPrompt = ({ className = '' }) => {
  const { supported, permission, subscribed, loading, enable, disable } = useNotifications();

  // Nothing to show: unsupported browser or user blocked notifications
  if (!supported || permission === 'denied') return null;

  if (subscribed) {
    return (
      <div
        className={`flex items-center justify-between rounded-lg border border-gold/20
          bg-gold/5 px-4 py-2 text-sm ${className}`}
      >
        <span className="text-gray-400">
          Push notifications <span className="text-gold font-medium">active</span>
        </span>
        <Button variant="ghost" size="sm" onClick={disable} disabled={loading}>
          {loading ? 'Disabling…' : 'Disable'}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between rounded-lg border border-gold/30
        bg-gold/10 px-4 py-2 text-sm ${className}`}
    >
      <span className="text-gray-300">
        Enable push notifications for field events
      </span>
      <Button variant="primary" size="sm" onClick={enable} disabled={loading}>
        {loading ? 'Enabling…' : 'Enable'}
      </Button>
    </div>
  );
};

export default NotificationPrompt;
