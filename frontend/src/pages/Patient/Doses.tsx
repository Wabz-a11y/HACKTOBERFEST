import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Reminder } from '../../types';
import { remindersApi } from '../../services/api';
import { ReminderCard } from '../../components/ReminderCard';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Calendar,
  Filter,
  RefreshCw,
} from 'lucide-react';

type FilterTab = 'all' | 'pending' | 'taken' | 'missed';

export const PatientDoses: React.FC = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [stats, setStats] = useState<any>({ adherence_percentage: 100, taken: 0, total: 0, missed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [data, st] = await Promise.all([remindersApi.list(), remindersApi.getStats()]);
      setReminders(data);
      setStats(st);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleTake = async (id: string) => {
    try {
      await remindersApi.updateStatus(id, 'taken');
      fetchAll(true);
    } catch (err) { console.error(err); }
  };

  const handleSnooze = async (id: string) => {
    try {
      await remindersApi.snooze(id, 15);
      fetchAll(true);
    } catch (err) { console.error(err); }
  };

  const filtered = reminders.filter((r) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return r.status === 'pending' || r.status === 'snoozed';
    return r.status === activeTab;
  });

  const tabs: { key: FilterTab; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All Doses', count: reminders.length, color: 'text-slate-700' },
    { key: 'pending', label: 'Pending', count: stats.pending ?? reminders.filter(r => r.status === 'pending' || r.status === 'snoozed').length, color: 'text-amber-600' },
    { key: 'taken', label: 'Taken', count: stats.taken ?? 0, color: 'text-emerald-600' },
    { key: 'missed', label: 'Missed', count: stats.missed ?? 0, color: 'text-rose-600' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-100 text-sky-700 rounded-2xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dose Schedule</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete medication log for {user?.full_name || 'you'}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Adherence Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Adherence', value: `${stats.adherence_percentage}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Total Doses', value: stats.total, icon: Calendar, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-100' },
          { label: 'Taken', value: stats.taken, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Missed', value: stats.missed, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-3.5 flex items-center gap-3 ${s.bg}`}>
            <s.icon className={`w-5 h-5 shrink-0 ${s.color}`} />
            <div>
              <p className="text-[11px] text-slate-500 font-medium">{s.label}</p>
              <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === t.key
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === t.key ? `bg-primary-100 text-primary-700` : 'bg-slate-200 text-slate-500'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Reminder List */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-sm">Loading dose schedule…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            {activeTab === 'all' ? 'No doses scheduled yet' : `No ${activeTab} doses`}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            {activeTab === 'all'
              ? 'Use MedAgent chat to scan a prescription and automatically create your reminder schedule.'
              : `There are no doses with "${activeTab}" status right now.`}
          </p>
          {activeTab === 'all' && (
            <Link
              to="/chat"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-semibold hover:bg-primary-700 transition"
            >
              Open MedAgent
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rem) => (
            <ReminderCard key={rem.id} reminder={rem} onTake={handleTake} onSnooze={handleSnooze} />
          ))}
        </div>
      )}
    </div>
  );
};

