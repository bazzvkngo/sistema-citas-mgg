// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// --- Componentes ---
import Navbar from './components/common/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';
import AgentRoute from './components/common/AgentRoute';
import AdminRoute from './components/common/AdminRoute';
import KioskRoute from './components/common/KioskRoute';
import ScreenRoute from './components/common/ScreenRoute'; // 👈 NUEVO

// --- Páginas ---
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

import './App.css';

export default function App() {
  return (
    <>
      <Navbar />
      
      <Routes>
        {/* --- Rutas Públicas --- */}
        <Route path="/ingreso" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/recuperar-contrasena" element={<PasswordRecovery />} />

        {/* Kiosko protegido: logueado + rol admin/kiosko */}
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

        {/* Pantalla TV: logueado + rol admin/pantalla */}
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

        {/* Seguimiento QR sigue siendo público */}
        <Route path="/qr-seguimiento" element={<TicketTracking />} />
        
        <Route path="/verificar-correo" element={<VerifyEmail />} />

        {/* --- Rutas Protegidas (usuario logueado y verificado) --- */}
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

        {/* --- Rutas de Staff --- */}
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

        {/* ✅ Rutas de Redirección y Comodín */}
        <Route path="/" element={<Navigate to="/inicio" replace />} />
        <Route path="*" element={<Navigate to="/ingreso" replace />} />
      </Routes>
    </>
  );
}
