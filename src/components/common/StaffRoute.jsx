import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function StaffRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) return <p className="page-container">Cargando...</p>;

  const rol = String(currentUser?.rol || '').toLowerCase().trim();
  const allowed = rol === 'admin' || rol === 'agente' || rol === 'agent';

  if (!allowed) return <Navigate to="/inicio" replace />;

  return children;
}
