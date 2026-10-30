import React, { useState, useEffect } from 'react';
import { clinicalApi } from '../../services/api';
import { AlertBadge } from '../../components/AlertBadge';
import { Users, AlertTriangle, TrendingUp, Phone, CheckCircle2, ShieldCheck, ChevronRight } from 'lucide-react';

export const CaregiverDashboard: React.FC = () => {
  const [patients, setPatients] = useState<any[]>([]);
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const p = await clinicalApi.getCaregiverPatients();
      setPatients(p);
      const f = await clinicalApi.getCaregiverFeed();
      setFeed(f);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Caregiver Overview Banner */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-orange-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-xs uppercase font-bold tracking-widest text-amber-200">
              Caregiver Command Center
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              Dependent Adherence Monitor
            </h1>
            <p className="text-sm text-amber-100 max-w-xl mt-1.5 leading-relaxed">
              Real-time synchronization with patient smart reminders. Gemma 4 automatically escalates unacknowledged doses
              and flags unusual physiological symptoms.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <TrendingUp className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-100">Cohort Adherence</p>
              <p className="text-2xl font-black text-white">{feed?.overall_adherence_index || '76.8'}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dependents Grid */}
      <div className="space-y-6 mb-8">
        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <Users className="w-5 h-5 text-amber-600" />
          <span>Linked Dependents ({patients.length})</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {patients.map((p) => (
            <div key={p.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-slate-900 text-lg">{p.full_name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                      {p.relationship} • Age {p.age}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Diagnoses: {p.chronic_conditions}</p>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    p.status === 'stable'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {p.status === 'stable' ? 'Stable' : 'Attention Required'}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Adherence</p>
                  <p className="text-lg font-bold text-slate-900">{p.adherence_rate}%</p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] text-emerald-600 font-semibold uppercase">Taken Today</p>
                  <p className="text-lg font-bold text-emerald-800">{p.today_taken_doses}</p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
                  <p className="text-[10px] text-amber-600 font-semibold uppercase">Pending</p>
                  <p className="text-lg font-bold text-amber-800">{p.today_pending_doses}</p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <a
                  href={`tel:${p.phone}`}
                  className="text-xs font-semibold text-slate-700 hover:text-amber-600 flex items-center space-x-1 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call {p.full_name}</span>
                </a>

                <button className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center space-x-1">
                  <span>View Medication Log</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Alerts Feed */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span>Real-time Notification Log</span>
        </h2>

        <div className="space-y-3">
          {feed?.recent_alerts?.map((a: any) => (
            <div key={a.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <AlertBadge severity={a.severity} />
                  <h4 className="font-semibold text-slate-900 text-sm">{a.title}</h4>
                </div>
                <p className="text-xs text-slate-600">{a.message}</p>
                <p className="text-[10px] text-slate-400 mt-1">Patient: {a.patient_name}</p>
              </div>
              <span className="text-[10px] text-slate-400">Recent</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

