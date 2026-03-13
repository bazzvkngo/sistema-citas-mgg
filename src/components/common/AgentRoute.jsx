import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import resolveUserRole from '../../utils/resolveUserRole';

export default function AgentRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const rol = resolveUserRole(currentUser);

  if (loading) {
    return <p className="page-container">Verificando permisos...</p>;
  }

  if (!currentUser || (rol !== 'agente' && rol !== 'admin')) {
    return <Navigate to="/inicio" />;
  }

  return children;
}
