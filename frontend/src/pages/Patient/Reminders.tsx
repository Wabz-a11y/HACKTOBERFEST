import React, { useState, useEffect } from 'react';
import { Reminder, Prescription } from '../../types';
import { remindersApi, prescriptionsApi } from '../../services/api';
import { Pill, Calendar, Clock, AlertCircle, Plus } from 'lucide-react';

export const PatientReminders: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    try {
      const data = await prescriptionsApi.list();
      setPrescriptions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Active Prescriptions & Regimens</h1>
          <p className="text-sm text-slate-500 mt-0.5">Verified medications configured with MedAgent reminders</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading prescription regimens...</div>
      ) : prescriptions.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
          <Pill className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800">No Prescriptions Recorded</h3>
          <p className="text-xs text-slate-500 mt-1">Use the MedAgent chat to upload or photograph your prescription.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-primary-100 text-primary-700 rounded-xl">
                    <Pill className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Prescription #{rx.id}</h3>
                    <p className="text-xs text-slate-400">Source: {rx.source}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
                  Verified Active
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {rx.medications.map((m, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-slate-900 text-base">{m.drug_name}</h4>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-primary-50 text-primary-700 rounded-md">
                        {m.dosage}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-2 font-medium">{m.frequency}</p>
                    <div className="text-xs text-slate-500 space-y-1">
                      <p>• Schedule: {m.times.join(', ')}</p>
                      <p>• Instructions: {m.instructions || 'Standard'}</p>
                      {m.warnings && <p className="text-amber-700">• Warning: {m.warnings}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

