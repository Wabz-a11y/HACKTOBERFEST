import React from 'react';
import { HospitalFacility } from '../types';
import { MapPin, Navigation, Phone, ShieldAlert } from 'lucide-react';

interface Props {
  hospitals: HospitalFacility[];
}

export const MapView: React.FC<Props> = ({ hospitals }) => {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
      <div className="flex items-center space-x-2.5 mb-4">
        <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Emergency Medical Facilities</h3>
          <p className="text-xs text-slate-500">Google Maps Places integration for urgent triage</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        {hospitals.map((h, idx) => (
          <div
            key={idx}
            className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-primary-300 transition"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-slate-900 text-sm">{h.name}</h4>
                <p className="text-xs text-slate-600 mt-0.5 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{h.address}</span>
                </p>
              </div>
              <span className="text-xs font-bold text-primary-700 bg-primary-100 px-2 py-0.5 rounded-md shrink-0">
                {h.distance_estimate || 'Nearby'}
              </span>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium flex items-center space-x-1 text-emerald-700">
                <Navigation className="w-3.5 h-3.5" />
                <span>{h.eta_minutes || '8-12 mins'}</span>
              </span>
              {h.phone && (
                <a
                  href={`tel:${h.phone}`}
                  className="font-medium text-slate-700 hover:text-primary-600 flex items-center space-x-1 transition"
                >
                  <Phone className="w-3 h-3" />
                  <span>{h.phone}</span>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

