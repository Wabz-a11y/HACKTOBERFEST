import React from 'react';
import { Reminder } from '../types';
import { CheckCircle2, Clock, FastForward, Pill } from 'lucide-react';

interface Props {
  reminder: Reminder;
  onTake: (id: string) => void;
  onSnooze: (id: string) => void;
}

export const ReminderCard: React.FC<Props> = ({ reminder, onTake, onSnooze }) => {
  const isTaken = reminder.status === 'taken';
  const isSnoozed = reminder.status === 'snoozed';

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Scheduled';
    }
  };

  return (
    <div
      className={`p-5 rounded-2xl border transition-all shadow-sm ${
        isTaken
          ? 'bg-emerald-50/60 border-emerald-200'
          : isSnoozed
          ? 'bg-amber-50/60 border-amber-200'
          : 'bg-white border-slate-200 hover:border-primary-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3.5">
          <div
            className={`p-3 rounded-xl ${
              isTaken ? 'bg-emerald-500 text-white' : 'bg-primary-50 text-primary-600'
            }`}
          >
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-lg">{reminder.medication_name}</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                {reminder.dosage}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">{reminder.instructions || 'Take as prescribed with water'}</p>
            <div className="flex items-center space-x-2 mt-2 text-xs font-medium text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Due: {formatTime(reminder.scheduled_time)}</span>
              {isTaken && (
                <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                  <span>• Taken</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {!isTaken && (
            <>
              <button
                onClick={() => onSnooze(reminder.id)}
                className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center space-x-1"
                title="Snooze 15 minutes"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Snooze</span>
              </button>
              <button
                onClick={() => onTake(reminder.id)}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Taken</span>
              </button>
            </>
          )}

          {isTaken && (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Completed</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

