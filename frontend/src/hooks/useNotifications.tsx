import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { API_BASE, alertsApi } from '../services/api';
import { useAuth } from './useAuth';

interface NotificationContextValue {
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refreshNotifications: async () => undefined,
  markAllRead: () => undefined,
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  const refreshNotifications = async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const alerts = await alertsApi.list();
      setUnreadCount(alerts.filter((alert) => !alert.acknowledged).length);
    } catch (error) {
      console.error('Unable to refresh notifications', error);
    }
  };

  useEffect(() => {
    if (!user) return;
    void refreshNotifications();

    const apiBase = API_BASE.replace(/\/api\/v1\/?$/, '');
    const socketBase = apiBase.startsWith('https:')
      ? apiBase.replace(/^https:/, 'wss:')
      : apiBase.replace(/^http:/, 'ws:');

    const connect = () => {
      const socket = new WebSocket(`${socketBase}/ws/${encodeURIComponent(user.id)}`);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        if (user.notifications_enabled === false) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'ALERT' || payload.type === 'MEDICATION_REMINDER') {
            setUnreadCount((count) => count + 1);
            window.dispatchEvent(new CustomEvent('medreminder:notification', { detail: payload }));

            if ('Notification' in window && Notification.permission === 'granted') {
              const title = payload.type === 'MEDICATION_REMINDER' ? payload.medication : payload.data?.title || 'MedReminder alert';
              new Notification(title, { body: payload.data?.message || payload.instructions || 'A new clinical alert is available.' });
            }
          }
        } catch {
          // Ignore non-JSON keepalive messages.
        }
      };

      socket.onclose = () => {
        reconnectTimer.current = window.setTimeout(connect, 5000);
      };
    };

    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
    connect();

    return () => {
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [user?.id]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshNotifications, markAllRead: () => setUnreadCount(0) }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
