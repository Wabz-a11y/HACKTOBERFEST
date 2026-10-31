import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Reminder, Alert } from '../../types';
import { remindersApi, alertsApi } from '../../services/api';
import {
  Camera,
  MessageSquare,
  TrendingUp,
  Pill,
  Bell,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Clock,
  ShieldCheck,
  Activity,
} from 'lucide-react';

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<any>({
    adherence_percentage: 100,
    taken: 0,
    total: 0,
    missed: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [data, st, alertData] = await Promise.all([
        remindersApi.list(),
        remindersApi.getStats(),
        alertsApi.list(),
      ]);
      setReminders(data);
      setStats(st);
      setAlerts(alertData.filter((a: Alert) => !a.acknowledged));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pendingToday = reminders
    .filter((r) => r.status === 'pending' || r.status === 'snoozed')
    .slice(0, 3); // show only next 3 on dashboard

  const urgentAlerts = alerts.filter((a) => a.severity === 'emergency' || a.severity === 'warning');

  const nextDose = pendingToday[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* ── Welcome Banner ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-primary-700 via-primary-600 to-sky-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* subtle grid pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-primary-200">
              Personal Medication Hub
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              Welcome back, {user?.full_name?.split(' ')[0]} 👋
            </h1>
            <p className="text-sm text-primary-100 max-w-xl mt-1.5 leading-relaxed">
              {stats.pending > 0
                ? `You have ${stats.pending} dose${stats.pending > 1 ? 's' : ''} pending today. MedAgent is monitoring your adherence.`
                : 'All doses are up to date. Great adherence today!'}
            </p>
          </div>

          {/* Adherence score */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4 self-start md:self-auto shrink-0">
            <div className="p-3 bg-white/20 rounded-xl">
              <TrendingUp className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-primary-100">Adherence Score</p>
              <p className="text-3xl font-black text-white">{stats.adherence_percentage}%</p>
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 flex flex-wrap gap-3">
          <Link
            to="/chat"
            className="px-4 py-2 bg-white text-primary-700 hover:bg-primary-50 rounded-xl font-semibold text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4 text-primary-600" />
            Consult MedAgent
          </Link>
          <Link
            to="/chat?action=camera"
            className="px-4 py-2 bg-primary-800/60 hover:bg-primary-800 border border-white/20 text-white rounded-xl font-semibold text-xs transition flex items-center gap-1.5"
          >
            <Camera className="w-4 h-4 text-primary-200" />
            Scan Prescription
          </Link>
          <Link
            to="/doses"
            className="px-4 py-2 bg-primary-800/60 hover:bg-primary-800 border border-white/20 text-white rounded-xl font-semibold text-xs transition flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4 text-primary-200" />
            Full Dose Schedule
          </Link>
        </div>
      </div>

      {/* ── Stats Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Doses',
            value: stats.total,
            icon: Pill,
            color: 'text-sky-600',
            bg: 'bg-sky-50 border-sky-100',
          },
          {
            label: 'Taken',
            value: stats.taken,
            icon: CheckCircle2,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50 border-emerald-100',
          },
          {
            label: 'Pending',
            value: stats.pending,
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-50 border-amber-100',
          },
          {
            label: 'Missed',
            value: stats.missed,
            icon: AlertCircle,
            color: 'text-rose-600',
            bg: 'bg-rose-50 border-rose-100',
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 flex items-center gap-3 ${s.bg}`}>
            <s.icon className={`w-5 h-5 shrink-0 ${s.color}`} />
            <div>
              <p className="text-[11px] text-slate-500 font-medium">{s.label}</p>
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column: Next Doses + Alerts ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Next 3 Upcoming Doses Preview */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-600" />
              <h2 className="text-sm font-bold text-slate-900">Next Up Today</h2>
            </div>
            <Link
              to="/doses"
              className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
          ) : pendingToday.length === 0 ? (
            <div className="py-6 text-center">
              <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">All clear!</p>
              <p className="text-xs text-slate-500 mt-1">No pending doses right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingToday.map((rem) => (
                <div
                  key={rem.id}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <div className="p-2 bg-primary-100 rounded-xl shrink-0">
                    <Pill className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{rem.medication_name}</p>
                    <p className="text-xs text-slate-500">{rem.dosage} · {rem.instructions || 'Take as directed'}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                    {rem.status === 'snoozed' ? 'Snoozed' : 'Pending'}
                  </span>
                </div>
              ))}
              {reminders.filter(r => r.status === 'pending' || r.status === 'snoozed').length > 3 && (
                <Link
                  to="/doses"
                  className="block text-center text-xs text-primary-600 font-semibold py-1 hover:text-primary-700"
                >
                  + {reminders.filter(r => r.status === 'pending' || r.status === 'snoozed').length - 3} more — View dose schedule
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Recent Unread Alerts */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-bold text-slate-900">Active Alerts</h2>
              {urgentAlerts.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-full">
                  {urgentAlerts.length}
                </span>
              )}
            </div>
            <Link
              to="/alerts"
              className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
          ) : alerts.length === 0 ? (
            <div className="py-6 text-center">
              <Activity className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">All clear!</p>
              <p className="text-xs text-slate-500 mt-1">No unacknowledged alerts.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {alerts.slice(0, 4).map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-2xl border flex gap-3 items-start ${
                    a.severity === 'emergency'
                      ? 'bg-rose-50 border-rose-200'
                      : a.severity === 'warning'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <AlertCircle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      a.severity === 'emergency'
                        ? 'text-rose-600'
                        : a.severity === 'warning'
                        ? 'text-amber-600'
                        : 'text-slate-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{a.title}</p>
                    <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Prescription shortcut ────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-100 rounded-3xl p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 rounded-2xl">
            <Pill className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Prescription Manager</h3>
            <p className="text-xs text-slate-500">View your active prescriptions and regimens</p>
          </div>
        </div>
        <Link
          to="/prescriptions"
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
        >
          View Prescriptions <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
