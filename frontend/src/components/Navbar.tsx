import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Pill, Bell, LogOut, Menu } from 'lucide-react';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
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
              <Link
                to="/alerts"
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full relative transition"
                title="Alerts"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
              </Link>

              <div className="h-6 w-px bg-slate-200"></div>

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
