export type UserRole = 'patient' | 'caregiver' | 'doctor';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  caregiver_id?: string;
  doctor_id?: string;
  emergency_contact?: string;
  profile_picture?: string;
  notifications_enabled?: boolean;
}

export interface MedicationItem {
  drug_name: string;
  dosage: string;
  frequency: string;
  times: string[];
  duration_days?: number;
  instructions?: string;
  warnings?: string;
}

export interface Prescription {
  id: string;
  patient_id: string;
  doctor_id?: string;
  source: string;
  raw_text?: string;
  image_url?: string;
  medications: MedicationItem[];
  notes?: string;
  created_at: string;
  verified: boolean;
}

export type ReminderStatus = 'pending' | 'taken' | 'snoozed' | 'missed';

export interface Reminder {
  id: string;
  patient_id: string;
  prescription_id?: string;
  medication_name: string;
  dosage: string;
  scheduled_time: string;
  instructions?: string;
  status: ReminderStatus;
  taken_at?: string;
}

export type AlertSeverity = 'info' | 'warning' | 'emergency';

export interface Alert {
  id: string;
  recipient_id: string;
  recipient_role: string;
  patient_id: string;
  patient_name: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  action_url?: string;
  acknowledged: boolean;
  starred: boolean;
  deleted?: boolean;
  created_at: string;
}

export interface HospitalFacility {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  emergency_service?: string;
  distance_estimate?: string;
  eta_minutes?: string;
  google_maps_url?: string;
  directions_url?: string;
}
