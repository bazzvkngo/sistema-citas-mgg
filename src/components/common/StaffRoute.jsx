import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import resolveUserRole from '../../utils/resolveUserRole';

export default function StaffRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) return <p className="page-container">Cargando...</p>;

  const rol = resolveUserRole(currentUser);
  const allowed = rol === 'admin' || rol === 'agente';

  if (!allowed) return <Navigate to="/inicio" replace />;

  return children;
}
