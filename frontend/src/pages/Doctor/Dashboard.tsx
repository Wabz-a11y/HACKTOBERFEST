import React, { useState, useEffect } from 'react';
import { clinicalApi } from '../../services/api';
import { Stethoscope, FileText, AlertCircle, ShieldAlert, CheckCircle2, ChevronRight, Activity } from 'lucide-react';

export const DoctorDashboard: React.FC = () => {
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const data = await clinicalApi.getDoctorPatients();
      setPatients(data);
      if (data.length > 0) {
        handleSelectPatient(data[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = async (p: any) => {
    setSelectedPatient(p);
    setSummaryLoading(true);
    try {
      const s = await clinicalApi.getPatientSummary(p.id);
      setSummary(s.summary);
    } catch (e) {
      console.error(e);
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Clinician Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-bold tracking-widest text-indigo-300">
                Physician Clinical Portal
              </span>
              <span className="text-xs bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full font-mono">
                Clinical Triage Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              Patient Adherence & Synthesis Hub
            </h1>
            <p className="text-sm text-slate-300 max-w-xl mt-1.5 leading-relaxed">
              Longitudinal adherence monitoring, automated symptom triage, and multimodal prescription management.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center space-x-4">
            <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300">Monitored Cohort</p>
              <p className="text-2xl font-black text-white">{patients.length} Active Patients</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Patient Roster */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Stethoscope className="w-5 h-5 text-indigo-600" />
            <span>Assigned Clinical Roster</span>
          </h2>

          <div className="space-y-3">
            {patients.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelectPatient(p)}
                className={`p-5 rounded-2xl border cursor-pointer transition shadow-sm ${
                  selectedPatient?.id === p.id
                    ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{p.full_name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p.gender}, Age {p.age} • {p.primary_diagnosis}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      p.risk_level === 'Low'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {p.risk_level} Risk
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Adherence: {p.adherence_percentage}%</span>
                  <span className="text-slate-400">Last Review: {p.last_review}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Patient AI Synthesis */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-6 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedPatient?.full_name}</h3>
                  <p className="text-xs text-slate-500">Automated Longitudinal Clinical Brief</p>
                </div>
              </div>

              <span className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold rounded-full">
                AI Clinical Tool Active
              </span>
            </div>

            {summaryLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                Generating longitudinal clinical synthesis...
              </div>
            ) : summary ? (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Adherence Rate</p>
                    <p className="text-2xl font-black text-indigo-700 mt-1">{summary.adherence_rate}</p>
                    <span className="text-xs text-emerald-600 font-medium">{summary.adherence_status}</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Reported Symptoms</p>
                    <p className="text-sm font-medium text-slate-800 mt-1">{summary.reported_symptoms}</p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-2">
                    Clinical Evaluation & Assessment
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{summary.clinical_assessment}</p>
                </div>

                <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1">
                    AI Recommendation
                  </h4>
                  <p className="text-sm text-emerald-800 font-medium">{summary.recommendation}</p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">Select a patient to inspect clinical overview.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

