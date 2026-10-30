import React from 'react';
import { AlertSeverity } from '../types';
import { AlertTriangle, Info, AlertOctagon } from 'lucide-react';

interface Props {
  severity: AlertSeverity;
}

export const AlertBadge: React.FC<Props> = ({ severity }) => {
  switch (severity) {
    case 'emergency':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
          <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
          <span>Emergency Triage</span>
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>Action Required</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300">
          <Info className="w-3.5 h-3.5 text-sky-600" />
          <span>Notice</span>
        </span>
      );
  }
};

