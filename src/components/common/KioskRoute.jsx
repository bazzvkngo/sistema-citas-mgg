// src/components/common/KioskRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import resolveUserRole from '../../utils/resolveUserRole';

export default function KioskRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const rol = resolveUserRole(currentUser);

  if (loading) {
    return (
      <div className="page-container">
        <p>Verificando permisos para el kiosko...</p>
      </div>
    );
  }

  // Solo permitimos:
  // - rol "kiosko"
  // - o "admin" (para pruebas / respaldo)
  if (
    !currentUser ||
    (rol !== 'kiosko' && rol !== 'admin')
  ) {
    return <Navigate to="/inicio" replace />;
  }

  return children;
}
