import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import ProtectedRoute from './components/common/ProtectedRoute';
import AgentRoute from './components/common/AgentRoute';
import AdminRoute from './components/common/AdminRoute';
import KioskRoute from './components/common/KioskRoute';
import ScreenRoute from './components/common/ScreenRoute';
import StaffRoute from './components/common/StaffRoute';

import { useAuth } from './context/AuthContext';
import resolveUserRole from './utils/resolveUserRole';

import Login from './pages/Login';
import Register from './pages/Register';
import PasswordRecovery from './pages/PasswordRecovery';
import Kiosk from './pages/Kiosk';
import MonitorScreen from './pages/MonitorScreen';
import TicketTracking from './pages/TicketTracking';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import UserProfile from './pages/UserProfile';
import AgentPanel from './pages/AgentPanel';
import AdminPanel from './pages/AdminPanel';
import Metrics from './pages/Metrics';
import VerifyEmail from './pages/VerifyEmail';
import Agenda from './pages/Agenda';
import CitizenProfile from './pages/CitizenProfile';

import './App.css';

function getHomeRouteByRole(rolRaw) {
  const rol = String(rolRaw || '').toLowerCase().trim();
  if (rol === 'ciudadano') return '/citas';
  if (rol === 'agente' || rol === 'agent') return '/panel-agente';
  if (rol === 'admin') return '/panel-agente';
  if (rol === 'pantalla') return '/pantalla-tv';
  if (rol === 'kiosko') return '/kiosko';
  return '/citas';
}

function HomeRedirect() {
  const { currentUser } = useAuth();
  // ProtectedRoute ya asegura login, pero dejamos fallback por seguridad
  if (!currentUser) return <Navigate to="/ingreso" replace />;
  return <Navigate to={getHomeRouteByRole(resolveUserRole(currentUser))} replace />;
}

export default function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/ingreso" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/recuperar-contrasena" element={<PasswordRecovery />} />

        <Route
          path="/kiosko"
          element={
            <ProtectedRoute>
              <KioskRoute>
                <Kiosk />
              </KioskRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/pantalla-tv"
          element={
            <ProtectedRoute>
              <ScreenRoute>
                <MonitorScreen />
              </ScreenRoute>
            </ProtectedRoute>
          }
        />

        <Route path="/qr-seguimiento" element={<TicketTracking />} />
        <Route path="/privacidad" element={<PrivacyPolicy />} />
        <Route
          path="/verificar-correo"
          element={
            <ProtectedRoute>
              <VerifyEmail />
            </ProtectedRoute>
          }
        />

        {/* ✅ /inicio ahora NO es una página, es un redirect inteligente */}
        <Route
          path="/inicio"
          element={
            <ProtectedRoute>
              <HomeRedirect />
            </ProtectedRoute>
          }
        />

        {/* ✅ Dashboard queda disponible (por si lo quieres para admin o futuro) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/citas"
          element={
            <ProtectedRoute>
              <Appointments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/panel-agente"
          element={
            <ProtectedRoute>
              <AgentRoute>
                <AgentPanel />
              </AgentRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/administrador"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/metricas"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <Metrics />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/agenda"
          element={
            <ProtectedRoute>
              <StaffRoute>
                <Agenda />
              </StaffRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/ciudadanos"
          element={
            <ProtectedRoute>
              <StaffRoute>
                <CitizenProfile />
              </StaffRoute>
            </ProtectedRoute>
          }
        />

        {/* ✅ Mantén / como /inicio, ahora redirige bien */}
        <Route path="/" element={<Navigate to="/inicio" replace />} />
        <Route path="*" element={<Navigate to="/ingreso" replace />} />
      </Routes>

      <Footer />
    </>
  );
}
