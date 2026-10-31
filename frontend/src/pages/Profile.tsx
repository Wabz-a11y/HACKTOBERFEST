import React, { ChangeEvent, FormEvent, useState } from 'react';
import { Bell, Camera, CheckCircle2, Lock, MessageSquare, Phone, ShieldAlert, Smartphone, UserRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../services/api';

const PasswordPanel: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (newPassword !== confirmation) {
      setError('New passwords do not match.');
      return;
    }
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setMessage('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not change password.');
    }
  };

  return (
    <form onSubmit={changePassword} className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-primary-600" />
        <h2 className="font-bold text-slate-900">Password</h2>
      </div>
      {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">Current password<input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-primary-500" /></label>
        <label className="text-sm font-medium text-slate-700">New password<input required minLength={6} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-primary-500" /></label>
        <label className="text-sm font-medium text-slate-700">Confirm password<input required minLength={6} type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-primary-500" /></label>
      </div>
      <div className="mt-5 flex justify-end"><button className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Update password</button></div>
    </form>
  );
};

export const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [emergencyContact, setEmergencyContact] = useState(user?.emergency_contact || '');
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notifications_enabled !== false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handlePicture = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Profile pictures must be smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfilePicture(String(reader.result));
    reader.readAsDataURL(file);
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await authApi.updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        emergency_contact: emergencyContact.trim(),
        profile_picture: profilePicture,
        notifications_enabled: notificationsEnabled,
      });
      updateUser(updated);
      setMessage('Profile settings saved successfully.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not save profile settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile & Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account information and notification preferences.</p>
      </div>

      {message && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />{message}</div>}
      {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <form onSubmit={saveProfile} className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-4 ring-slate-50">
            {profilePicture ? <img src={profilePicture} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-16 w-16 text-slate-300" />}
          </div>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Camera className="h-4 w-4" /> Change picture
            <input type="file" accept="image/*" className="hidden" onChange={handlePicture} />
          </label>
          {profilePicture && <button type="button" onClick={() => setProfilePicture('')} className="mt-2 block w-full text-xs text-slate-500 hover:text-rose-600">Remove picture</button>}
          <p className="mt-3 text-xs text-slate-400">JPG, PNG or GIF. Maximum 2 MB.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-900">Account Information</h2>
              <p className="text-xs text-slate-500 mt-0.5">Manage your personal details and SMS alert contact numbers.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <MessageSquare className="w-3 h-3 text-emerald-600" />
              TalkSasa SMS Ready
            </span>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Full name
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-normal outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
            </label>

            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-primary-600" />
                Mobile Phone (for SMS Dose Reminders)
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Phone className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +254 712 345 678 or 0712 345 678"
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 font-normal outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Used by MedAgent to send SMS alerts whenever a medication dose is missed.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Emergency Contact Phone
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Phone className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="tel"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="e.g. +254 798 765 432 (Caregiver or Family member)"
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 font-normal outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Contacted during acute medical symptom triage or critical dose escalation.
              </p>
            </div>

            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-slate-700">Email address</p>
              <p className="mt-1.5 rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5 text-sm text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Notifications</p>
                <p className="text-xs text-slate-500">Receive medication and emergency alerts.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNotificationsEnabled((enabled) => !enabled)}
              className={`relative h-6 w-11 rounded-full transition ${notificationsEnabled ? 'bg-primary-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${notificationsEnabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              disabled={saving}
              className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </section>
      </form>

      <PasswordPanel />
    </div>
  );
};
