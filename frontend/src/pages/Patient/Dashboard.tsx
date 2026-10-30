import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Reminder } from '../../types';
import { remindersApi } from '../../services/api';
import { ReminderCard } from '../../components/ReminderCard';
import { Camera, CheckCircle2, Clock, MessageSquare, AlertCircle, TrendingUp } from 'lucide-react';

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [stats, setStats] = useState<any>({ adherence_percentage: 100, taken: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      const data = await remindersApi.list();
      setReminders(data);
      const st = await remindersApi.getStats();
      setStats(st);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTake = async (id: string) => {
    try {
      await remindersApi.updateStatus(id, 'taken');
      fetchReminders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSnooze = async (id: string) => {
    try {
      await remindersApi.snooze(id, 15);
      fetchReminders();
    } catch (err) {
      console.error(err);
    }
  };

  const pendingReminders = reminders.filter((r) => r.status === 'pending' || r.status === 'snoozed');
  const completedReminders = reminders.filter((r) => r.status === 'taken');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Welcome & Adherence Banner */}
      <div className="bg-gradient-to-r from-primary-700 via-primary-600 to-sky-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-xs uppercase font-bold tracking-widest text-primary-200">
              Personal Medication Hub
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              Welcome back, {user?.full_name}
            </h1>
            <p className="text-sm text-primary-100 max-w-xl mt-1.5 leading-relaxed">
              You have {pendingReminders.length} doses scheduled for today. MedAgent is actively monitoring your adherence
              and coordinating with your caregiver.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center space-x-4 self-start md:self-auto">
            <div className="p-3 bg-white/20 rounded-xl">
              <TrendingUp className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-primary-100">Adherence Score</p>
              <p className="text-2xl font-black text-white">{stats.adherence_percentage}%</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap gap-3">
          <Link
            to="/chat"
            className="px-4 py-2 bg-white text-primary-700 hover:bg-primary-50 rounded-xl font-semibold text-xs transition shadow-sm flex items-center space-x-1.5"
          >
            <MessageSquare className="w-4 h-4 text-primary-600" />
            <span>Consult MedAgent</span>
          </Link>
          <Link
            to="/chat?action=camera"
            className="px-4 py-2 bg-primary-800/60 hover:bg-primary-800 border border-white/20 text-white rounded-xl font-semibold text-xs transition flex items-center space-x-1.5"
          >
            <Camera className="w-4 h-4 text-primary-200" />
            <span>Scan Prescription</span>
          </Link>
        </div>
      </div>

      {/* Main Medication List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-bold text-slate-900">Upcoming Today</h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg border border-primary-100">
            {pendingReminders.length} Remaining
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading daily schedule...</div>
        ) : pendingReminders.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-900">All doses up to date!</h3>
            <p className="text-xs text-slate-500 mt-1">
              You have completed all scheduled medications for this window. Great job maintaining adherence!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingReminders.map((rem) => (
              <ReminderCard key={rem.id} reminder={rem} onTake={handleTake} onSnooze={handleSnooze} />
            ))}
          </div>
        )}

        {completedReminders.length > 0 && (
          <div className="pt-6">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
              Taken Today ({completedReminders.length})
            </h2>
            <div className="grid grid-cols-1 gap-3 opacity-80">
              {completedReminders.map((rem) => (
                <ReminderCard key={rem.id} reminder={rem} onTake={handleTake} onSnooze={handleSnooze} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

