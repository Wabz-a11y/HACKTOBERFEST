import React, { useState, useEffect } from 'react';
import { Alert } from '../types';
import { alertsApi } from '../services/api';
import { AlertBadge } from '../components/AlertBadge';
import { Bell, Check, ShieldAlert } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const data = await alertsApi.list();
      setAlerts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await alertsApi.acknowledge(id);
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Alerts & Notifications</h1>
            <p className="text-sm text-slate-500 mt-0.5">Context-aware escalations and clinical notices</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading alerts stream...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800">No Active Alerts</h3>
          <p className="text-xs text-slate-500 mt-1">All medications and physiological parameters are within normal thresholds.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`p-6 rounded-3xl border transition shadow-sm bg-white ${
                !a.acknowledged ? 'border-primary-300 ring-2 ring-primary-500/10' : 'border-slate-200 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <AlertBadge severity={a.severity} />
                    <h3 className="font-bold text-slate-900 text-base">{a.title}</h3>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{a.message}</p>
                  <p className="text-xs text-slate-400">Target Role: {a.recipient_role} • Patient: {a.patient_name}</p>
                </div>

                {!a.acknowledged ? (
                  <button
                    onClick={() => handleAcknowledge(a.id)}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-sm transition flex items-center space-x-1 shrink-0 ml-4"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Acknowledge</span>
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg shrink-0 ml-4">
                    Acknowledged
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

