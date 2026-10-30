import React, { useState } from 'react';
import { HospitalFacility } from '../types';
import { MapPin, Navigation, Phone, ShieldAlert, ExternalLink, Route as RouteIcon, Map } from 'lucide-react';

interface Props {
  hospitals: HospitalFacility[];
}

export const MapView: React.FC<Props> = ({ hospitals }) => {
  const [selectedFacility, setSelectedFacility] = useState<HospitalFacility | null>(
    hospitals.length > 0 ? hospitals[0] : null
  );

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl shadow-sm">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-base">Emergency Facilities & Routing</h3>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full">
                Live Triage
              </span>
            </div>
            <p className="text-xs text-slate-500">Closest certified emergency trauma centers & pharmacies</p>
          </div>
        </div>

        {selectedFacility?.directions_url && (
          <a
            href={selectedFacility.directions_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center space-x-1.5 px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <RouteIcon className="w-3.5 h-3.5" />
            <span>Open in Maps</span>
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </a>
        )}
      </div>

      {/* Interactive Map Visual Header (Mirrored from HOUSEKONECT Google Maps Style) */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 h-44 flex flex-col justify-end p-4 shadow-inner">
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-70"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent"></div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-2 text-white">
          <div>
            <div className="flex items-center space-x-1.5 text-xs text-rose-300 font-semibold mb-1">
              <MapPin className="w-3.5 h-3.5 animate-bounce" />
              <span>Target: {selectedFacility?.name || 'Nearest Facility'}</span>
            </div>
            <p className="text-xs text-slate-200 max-w-md line-clamp-1">{selectedFacility?.address}</p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white/20 backdrop-blur-md border border-white/30 text-white">
              ETA: {selectedFacility?.eta_minutes || '6 mins'}
            </span>
            {selectedFacility?.directions_url && (
              <a
                href={selectedFacility.directions_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-white text-slate-900 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-sm flex items-center space-x-1"
              >
                <span>Navigate</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Facilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
        {hospitals.map((h, idx) => {
          const isSelected = selectedFacility?.name === h.name;
          return (
            <div
              key={idx}
              onClick={() => setSelectedFacility(h)}
              className={`p-4 rounded-2xl border cursor-pointer transition shadow-sm ${
                isSelected
                  ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/10'
                  : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-primary-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-tight">{h.name}</h4>
                  <p className="text-xs text-slate-600 mt-1 flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="line-clamp-1">{h.address}</span>
                  </p>
                  {h.emergency_service && (
                    <span className="inline-block mt-2 text-[10px] font-semibold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md">
                      {h.emergency_service}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-primary-700 bg-primary-100 px-2 py-0.5 rounded-md shrink-0 ml-2">
                  {h.distance_estimate || 'Nearby'}
                </span>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold flex items-center space-x-1 text-emerald-700">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{h.eta_minutes || '8-12 mins drive'}</span>
                </span>

                <div className="flex items-center space-x-2">
                  {h.phone && (
                    <a
                      href={`tel:${h.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-slate-700 hover:text-primary-600 flex items-center space-x-1 p-1 rounded-lg hover:bg-slate-100 transition"
                      title={`Call ${h.name}`}
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline">{h.phone}</span>
                    </a>
                  )}

                  {h.directions_url && (
                    <a
                      href={h.directions_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-primary-600 hover:text-primary-700 flex items-center space-x-0.5 text-xs underline decoration-primary-300 underline-offset-2 ml-1"
                    >
                      <span>Directions</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
