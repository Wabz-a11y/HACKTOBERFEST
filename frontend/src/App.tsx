import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Auth/Login';
import { Register } from './pages/Auth/Register';
import { PatientDashboard } from './pages/Patient/Dashboard';
import { PatientChat } from './pages/Patient/Chat';
import { PatientReminders } from './pages/Patient/Reminders';
import { CaregiverDashboard } from './pages/Caregiver/Dashboard';
import { DoctorDashboard } from './pages/Doctor/Dashboard';
import { AlertsPage } from './pages/Alerts';

const RoleBasedHome: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'caregiver') return <CaregiverDashboard />;
  if (user.role === 'doctor') return <DoctorDashboard />;
  return <PatientDashboard />;
};

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-12 text-center text-slate-500">Authenticating...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <RoleBasedHome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <PatientChat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/prescriptions"
                element={
                  <ProtectedRoute>
                    <PatientReminders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/alerts"
                element={
                  <ProtectedRoute>
                    <AlertsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

