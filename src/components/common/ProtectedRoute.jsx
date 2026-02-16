// src/components/common/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const REQUIRE_EMAIL_VERIFIED = false; // Cambiar a true si se requiere verificación de correo electrónico

export default function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <p className="page-container">Cargando...</p>;
  }

  if (!currentUser) {
    return <Navigate to="/ingreso" />;
  }

  if (REQUIRE_EMAIL_VERIFIED && !currentUser.emailVerified) {
    return <Navigate to="/verificar-correo" />;
  }

  return children;
}
