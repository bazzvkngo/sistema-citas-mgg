import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/common/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';
import AgentRoute from './components/common/AgentRoute';
import AdminRoute from './components/common/AdminRoute';
import KioskRoute from './components/common/KioskRoute';
import ScreenRoute from './components/common/ScreenRoute';
import StaffRoute from './components/common/StaffRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import PasswordRecovery from './pages/PasswordRecovery';
import Kiosk from './pages/Kiosk';
import MonitorScreen from './pages/MonitorScreen';
import TicketTracking from './pages/TicketTracking';
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
        <Route path="/verificar-correo" element={<VerifyEmail />} />

        <Route
          path="/inicio"
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

        <Route path="/" element={<Navigate to="/inicio" replace />} />
        <Route path="*" element={<Navigate to="/ingreso" replace />} />
      </Routes>
    </>
  );
}
