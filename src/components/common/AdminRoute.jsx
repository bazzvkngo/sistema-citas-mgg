import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <p className="page-container">Verificando permisos...</p>;
  }

  if (!currentUser || currentUser.rol !== 'admin') {
    return <Navigate to="/inicio" />;
  }

  return children;
}