import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Pill,
  Bell,
  Users,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  interface NavItem {
    name: string;
    to: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    badge?: string;
  }

  let navItems: NavItem[] = [];

  if (user.role === 'patient') {
    navItems = [
      {
        name: 'Overview',
        to: '/',
        icon: LayoutDashboard,
        color: 'text-primary-600',
      },
      {
        name: 'Dose Schedule',
        to: '/doses',
        icon: Calendar,
        color: 'text-sky-600',
      },
      {
        name: 'MedAgent Chat',
        to: '/chat',
        icon: MessageSquare,
        color: 'text-emerald-600',
      },
      {
        name: 'Prescriptions',
        to: '/prescriptions',
        icon: Pill,
        color: 'text-indigo-600',
      },
      {
        name: 'Alerts',
        to: '/alerts',
        icon: Bell,
        color: 'text-rose-600',
      },
    ];
  } else if (user.role === 'caregiver') {
    navItems = [
      {
        name: 'Dashboard',
        to: '/',
        icon: LayoutDashboard,
        color: 'text-primary-600',
      },
      {
        name: 'Dependents Overview',
        to: '/doses',
        icon: Users,
        color: 'text-amber-600',
      },
      {
        name: 'Alerts',
        to: '/alerts',
        icon: Bell,
        color: 'text-rose-600',
      },
    ];
  } else if (user.role === 'doctor') {
    navItems = [
      {
        name: 'Dashboard',
        to: '/',
        icon: LayoutDashboard,
        color: 'text-primary-600',
      },
      {
        name: 'Clinical Roster',
        to: '/doses',
        icon: Stethoscope,
        color: 'text-rose-600',
      },
      {
        name: 'Alerts',
        to: '/alerts',
        icon: Bell,
        color: 'text-rose-600',
      },
    ];
  }

  const isItemActive = (to: string) => {
    if (to === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(to);
  };

  return (
    <aside
      className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out select-none shadow-sm z-30 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Sidebar Header / Role indicator */}
      <div className="h-14 border-b border-slate-100 flex items-center px-4 justify-between">
        {!isCollapsed && (
          <div className="overflow-hidden">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</span>
            <p className="text-xs font-semibold text-slate-700 capitalize truncate">{user.role} Workspace</p>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ${
            isCollapsed ? 'mx-auto' : ''
          }`}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Nav items list */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isItemActive(item.to);
          const Icon = item.icon;

          return (
            <NavLink
              key={item.name}
              to={item.to}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all group relative ${
                active
                  ? 'bg-primary-50 text-primary-700 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div
                className={`flex items-center justify-center ${
                  active ? item.color : 'text-slate-500 group-hover:text-slate-800'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
              </div>

              {!isCollapsed && (
                <span className={`ml-3 truncate ${active ? 'font-semibold text-primary-900' : ''}`}>
                  {item.name}
                </span>
              )}

              {/* Collapsed Tooltip on Hover */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition whitespace-nowrap z-50">
                  {item.name}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Footer with collapse prompt when expanded */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">Smart Medication Assistant</p>
          <p className="text-[10px] text-slate-300 mt-0.5 hidden sm:block">
            Overview = summary · Dose Schedule = full log
          </p>
        </div>
      )}
    </aside>
  );
};

