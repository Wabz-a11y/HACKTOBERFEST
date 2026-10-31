import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { CheckCheck, Pill, Bell, LogOut, Menu, Star, Trash2 } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { alertsApi } from '../services/api';
import { Alert } from '../types';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount, refreshNotifications, markAllRead } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const openNotifications = async () => {
    const willOpen = !notificationsOpen;
    setNotificationsOpen(willOpen);
    if (!willOpen) return;

    setNotificationsLoading(true);
    try {
      setAlerts(await alertsApi.list());
    } catch (error) {
      console.error('Unable to load notifications', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const refreshPopup = async () => {
    setAlerts(await alertsApi.list());
    await refreshNotifications();
  };

  const handleMarkAsRead = async (id: string) => {
    await alertsApi.acknowledge(id);
    await refreshPopup();
  };

  const handleMarkAllRead = async () => {
    await alertsApi.markAllRead();
    markAllRead();
    await refreshPopup();
  };

  const handleToggleStar = async (id: string) => {
    await alertsApi.toggleStar(id);
    await refreshPopup();
  };

  const handleDelete = async (id: string) => {
    await alertsApi.remove(id);
    await refreshPopup();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-3">
            {user && onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                title="Toggle sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <Link to="/" className="flex items-center space-x-2">
              <div className="bg-primary-600 text-white p-2 rounded-xl shadow-md">
                <Pill className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-lg text-slate-900 tracking-tight">MedReminder</span>
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-sky-100 text-sky-800 rounded-full border border-sky-200">
                  AI Assistant
                </span>
              </div>
            </Link>
          </div>

          {user && (
            <div className="flex items-center space-x-3">
              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  onClick={openNotifications}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full relative transition"
                  title="Notifications"
                  aria-expanded={notificationsOpen}
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <h2 className="text-sm font-bold text-slate-900">Notifications</h2>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notificationsLoading ? (
                        <p className="px-4 py-6 text-center text-xs text-slate-400">Loading notifications...</p>
                      ) : alerts.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-slate-400">No notifications yet.</p>
                      ) : (
                        alerts.slice(0, 6).map((alert) => (
                          <div
                            key={alert.id}
                            className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                          >
                            <div className="flex items-start gap-2">
                              {!alert.acknowledged && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
                              <div className={alert.acknowledged ? 'pl-4' : ''}>
                                <p className="text-sm font-semibold text-slate-800">{alert.title}</p>
                                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{alert.message}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-1">
                              {!alert.acknowledged && (
                                <button type="button" onClick={() => handleMarkAsRead(alert.id)} title="Mark as read" className="rounded-lg p-1.5 text-slate-400 hover:bg-primary-50 hover:text-primary-600">
                                  <CheckCheck className="h-4 w-4" />
                                </button>
                              )}
                              <button type="button" onClick={() => handleToggleStar(alert.id)} title={alert.starred ? 'Remove star' : 'Star notification'} className={`rounded-lg p-1.5 hover:bg-amber-50 ${alert.starred ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}>
                                <Star className={`h-4 w-4 ${alert.starred ? 'fill-current' : ''}`} />
                              </button>
                              <button type="button" onClick={() => handleDelete(alert.id)} title="Delete notification" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-6 w-px bg-slate-200"></div>

              <Link to="/profile" className="flex items-center gap-3 hover:opacity-80">
                {user.profile_picture && <img src={user.profile_picture} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-100" />}
                {!user.profile_picture && <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">{user.full_name.charAt(0).toUpperCase()}</div>}
              </Link>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-tight">{user.full_name}</p>
                <p className="text-xs uppercase font-medium tracking-wider text-slate-500">{user.role}</p>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
