import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
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

const MainLayout: React.FC = () => {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <Navbar onToggleSidebar={user ? toggleSidebar : undefined} />
      <div className="flex flex-1">
        {user && <Sidebar isCollapsed={isCollapsed} onToggleCollapse={toggleSidebar} />}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <RoleBasedHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doses"
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
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<MainLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
