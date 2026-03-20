import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import resolveUserRole from '../../utils/resolveUserRole';

export default function AdminRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const rol = resolveUserRole(currentUser);
  const isAllowed = rol === 'admin' || rol === 'superadmin';

  if (loading) {
    return <p className="page-container">Verificando permisos...</p>;
  }

  if (!currentUser || !isAllowed) {
    return <Navigate to="/inicio" />;
  }

  return children;
}
